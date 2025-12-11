import base64
import io
from PIL import Image
import numpy as np
from flask import Flask, request, jsonify

# --------------------------
# BASIC FACE COLOR SAMPLING
# --------------------------

app = Flask(__name__)

def get_avg_color(img, x1, y1, x2, y2):
    region = img[y1:y2, x1:x2]
    if region.size == 0:
        return [0, 0, 0]
    return np.mean(region.reshape(-1, 3), axis=0).tolist()

def classify_undertone(cheek, neck):
    c_r, c_g, c_b = cheek
    n_r, n_g, n_b = neck

    diff = (c_r - n_r) + (c_g - n_g) + (c_b - n_b)

    if diff > 20:
        return "Warm"
    elif diff < -20:
        return "Cool"
    else:
        return "Neutral"

def classify_brightness_depth(cheek):
    brightness = np.mean(cheek)

    if brightness > 170:
        depth = "Light"
    elif brightness < 90:
        depth = "Deep"
    else:
        depth = "Medium"

    if cheek[0] + cheek[1] + cheek[2] > 450:
        brightsoft = "Bright"
    else:
        brightsoft = "Soft"

    return brightsoft, depth

@app.route("/", methods=["POST"])
def analyze():
    try:
        data = request.json
        image_b64 = data.get("image")

        if not image_b64:
            return jsonify({"error": "No image provided"}), 400

        img_bytes = base64.b64decode(image_b64)
        pil_img = Image.open(io.BytesIO(img_bytes)).convert("RGB")

        img = np.array(pil_img)
        h, w, _ = img.shape

        # SAMPLE AREAS (approx)
        cheek = get_avg_color(img, w//3, h//3, w//3 + 40, h//3 + 40)
        neck = get_avg_color(img, w//3, int(h*0.75), w//3 + 40, int(h*0.75) + 40)

        undertone = classify_undertone(cheek, neck)
        brightsoft, depth = classify_brightness_depth(cheek)

        return jsonify({
            "undertone": undertone,
            "brightness_softness": brightsoft,
            "depth": depth,
            "cheek_sample_rgb": cheek,
            "neck_sample_rgb": neck
        })

    except Exception as e:
        return jsonify({"error": "Processing failed", "details": str(e)}), 500

# Required for Vercel
def handler(request):
    with app.app_context():
        return analyze()
