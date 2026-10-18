import {registerHooks} from 'node:module';
import {readFileSync} from 'node:fs';
registerHooks({resolve(specifier,context,nextResolve){
  if(/^next\/(cache|headers|server|navigation)$/.test(specifier))return nextResolve(specifier+'.js',context);
  return nextResolve(specifier,context);
},load(url,context,nextLoad){
  if(url.endsWith('.json')&&url.includes('/pwa/src/generated/'))return {format:'module',source:'export default '+JSON.stringify(JSON.parse(readFileSync(new URL(url),'utf8')))+';',shortCircuit:true};
  return nextLoad(url,context);
}});
