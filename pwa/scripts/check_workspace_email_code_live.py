"""Existing test account only: generate a code WITHOUT sending mail, verify via app.
Credentials and OTP/cookies remain in process memory. Does not grant access.
"""
import argparse, http.cookiejar, json, pathlib, urllib.request, urllib.parse, urllib.error

parser = argparse.ArgumentParser()
parser.add_argument('--base', required=True)
parser.add_argument('--email', default='asahina.ic@gmail.com')
args = parser.parse_args()
env = {}
for line in (pathlib.Path(__file__).resolve().parents[1] / '.env.local').read_text().splitlines():
    if '=' in line and not line.lstrip().startswith('#'):
        key, value = line.split('=', 1)
        env[key.strip()] = value.strip().strip('\"\'')
url, key = env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY']
headers = {'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'}

def read_json(path, body=None):
    request = urllib.request.Request(url + path, headers=headers,
        data=None if body is None else json.dumps(body).encode())
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)

# The test account must already be active/bound; do not activate invited teachers.
query = urllib.parse.urlencode({'email_normalized': 'eq.' + args.email,
    'select': 'id,status,auth_user_id'})
account = read_json('/rest/v1/workspace_user_accounts?' + query)
assert len(account) == 1 and account[0]['status'] == 'active' and account[0]['auth_user_id'], 'Existing active test account required'
link = read_json('/auth/v1/admin/generate_link', {'type': 'magiclink', 'email': args.email,
    'redirect_to': args.base + '/auth/callback'})
assert link['id'] == account[0]['auth_user_id'], 'Auth identity must remain unchanged'
token = link['email_otp']
assert token.isdigit() and 6 <= len(token) <= 10
jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
body = urllib.parse.urlencode({'email': args.email, 'token': token, 'next': '/workspaces'}).encode()
request = urllib.request.Request(args.base + '/auth/callback', data=body,
    headers={'Origin': args.base, 'Content-Type': 'application/x-www-form-urlencoded'})
with opener.open(request, timeout=60) as response:
    page = response.read().decode()
    assert response.status == 200 and urllib.parse.urlparse(response.url).path == '/workspaces', 'OTP must reach workspaces'
    assert '/dd/sol' in page and '/project/p21/workspace' in page, 'SOL workspace and DD entries required'
assert any(c.name == 'amd_os_workspace_session' and c.value for c in jar), 'Signed external session required'
assert not any(c.name.startswith('sb-') and c.value for c in jar), 'No Supabase member session may remain'
with opener.open(args.base + '/dd/sol', timeout=60) as response:
    page = response.read().decode()
    assert response.status == 200 and 'SolvioraX' in page, 'SOL DD body required'
# Same code cannot establish another session.
empty_opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
with empty_opener.open(request, timeout=60) as response:
    assert urllib.parse.parse_qs(urllib.parse.urlparse(response.url).query).get('error') == ['workspace_code_failed'], 'Used code must be rejected'
print(json.dumps({'otpLogin': 'passed', 'workspaceEntries': 'SOL workspace and SOL DD',
    'ddBody': 'SolvioraX', 'codeReplay': 'rejected', 'pkceCookieRequired': False,
    'emailSent': False, 'teacherLoginConfirmed': False}))
