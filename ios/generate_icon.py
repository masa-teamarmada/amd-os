#!/usr/bin/env python3
"""
AMD OS App Icon Generator
白背景 + ぷっくり立体感（バンプマップ + ドロップシャドウ + グロス）
"""

import os
import numpy as np
from PIL import Image, ImageFilter, ImageDraw

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(BASE_DIR, "logo_trans.png")
OUT_DIR = os.path.join(BASE_DIR, "AMDOS/Resources/Assets.xcassets/AppIcon.appiconset")

SIZES = {
    "Icon-20.png":   20,
    "Icon-29.png":   29,
    "Icon-40.png":   40,
    "Icon-58.png":   58,
    "Icon-60.png":   60,
    "Icon-76.png":   76,
    "Icon-80.png":   80,
    "Icon-87.png":   87,
    "Icon-120.png":  120,
    "Icon-152.png":  152,
    "Icon-167.png":  167,
    "Icon-180.png":  180,
    "Icon-1024.png": 1024,
}

SIZE = 1024


def make_3d_icon(src_path: str) -> Image.Image:
    """ぷっくり3D効果付きアイコンを生成（白背景）"""

    # ── 1. ソース読み込み（RGBA確定）─────────────────────────────────
    logo = Image.open(src_path).convert("RGBA").resize((SIZE, SIZE), Image.LANCZOS)
    arr = np.array(logo, dtype=np.float32)  # H×W×4

    r_ch = arr[:, :, 0]
    g_ch = arr[:, :, 1]
    b_ch = arr[:, :, 2]
    a_ch = arr[:, :, 3]  # 0〜255: 背景=0、ロゴ本体≈255、グロー=中間

    # ── 2. 高さマップ = アルファをぼかして丘なりに ──────────────────
    alpha_01 = a_ch / 255.0  # 0〜1
    h_img = Image.fromarray((alpha_01 * 255).astype(np.uint8))
    h_blur = h_img.filter(ImageFilter.GaussianBlur(radius=20))
    height = np.array(h_blur, dtype=np.float32) / 255.0

    # ── 3. 法線マップ（高さ勾配から） ──────────────────────────────
    gy, gx = np.gradient(height)
    strength = 7.0   # ↑ほどぷっくり（3〜10推奨）
    nx = -gx * strength
    ny = -gy * strength
    nz = np.ones_like(nx)
    norm_len = np.sqrt(nx**2 + ny**2 + nz**2) + 1e-8
    nx /= norm_len
    ny /= norm_len
    nz /= norm_len

    # ── 4. ライティング（左上から） ─────────────────────────────────
    lx, ly, lz = 0.50, -0.60, 0.72
    ln = np.sqrt(lx**2 + ly**2 + lz**2)
    lx, ly, lz = lx/ln, ly/ln, lz/ln

    diffuse = np.clip(nx*lx + ny*ly + nz*lz, 0, 1)

    # スペキュラ（鋭い輝点）
    # R = 2(N·L)N - L, view = (0,0,1)
    spec = np.clip(2 * diffuse * nz - lz, 0, 1) ** 40 * 0.85

    ambient = 0.20
    lighting = ambient + diffuse * 0.85 + spec  # 合計輝度

    # ── 5. ロゴのRGB に照明乗算 ────────────────────────────────────
    lit_r = np.clip(r_ch * lighting, 0, 255)
    lit_g = np.clip(g_ch * lighting, 0, 255)
    lit_b = np.clip(b_ch * lighting, 0, 255)

    lit_arr = np.stack([lit_r, lit_g, lit_b, a_ch], axis=2).astype(np.uint8)
    lit_logo = Image.fromarray(lit_arr, "RGBA")

    # ── 6. ドロップシャドウ（右下オフセット）────────────────────────
    shadow_alpha = np.array(
        Image.fromarray((alpha_01 * 180).astype(np.uint8))
              .filter(ImageFilter.GaussianBlur(radius=32)),
        dtype=np.float32
    )
    # シャドウ画像（黒半透明）
    sh_arr = np.zeros((SIZE, SIZE, 4), dtype=np.uint8)
    sh_arr[:, :, 3] = shadow_alpha.astype(np.uint8)
    shadow_img = Image.fromarray(sh_arr, "RGBA")

    offset = 22  # 右下へずらす量
    shadow_canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    shadow_canvas.paste(shadow_img, (offset, offset))

    # ── 7. 白背景に重ねて完成 ───────────────────────────────────────
    white = Image.new("RGBA", (SIZE, SIZE), (255, 255, 255, 255))
    canvas = Image.alpha_composite(white, shadow_canvas)
    canvas = Image.alpha_composite(canvas, lit_logo)

    # ── 8. グロスオーバーレイ（上部ガラス光沢） ────────────────────
    gloss = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(gloss)

    for i in range(180):
        t = i / 180.0
        a_val = int((1.0 - t) ** 2.2 * 65)   # 最大65/255の白
        y0 = int(t * SIZE * 0.42)
        mx = int(SIZE * 0.08 + t * SIZE * 0.15)
        gdraw.ellipse(
            [mx, y0, SIZE - mx, y0 + SIZE // 5],
            fill=(255, 255, 255, a_val)
        )

    canvas = Image.alpha_composite(canvas, gloss)

    return canvas.convert("RGB")


def main():
    print("🎨 AMD OS アイコン生成開始...")
    icon_1024 = make_3d_icon(SRC)

    preview_path = os.path.join(BASE_DIR, "icon_preview.png")
    icon_1024.save(preview_path, "PNG")
    print(f"  プレビュー → {preview_path}")

    for filename, size in SIZES.items():
        out_path = os.path.join(OUT_DIR, filename)
        resized = icon_1024 if size == 1024 else icon_1024.resize((size, size), Image.LANCZOS)
        resized.save(out_path, "PNG")
        print(f"  {size:4d}px → {filename}")

    print("✅ 完了！")


if __name__ == "__main__":
    main()
