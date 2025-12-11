from fastapi import FastAPI, UploadFile, File
from analyze import analyze_image_basic
import uvicorn

app = FastAPI()

@app.get("/")
def home():
    return {"status": "running", "message": "Haneul Palette Basic AI Backend"}

@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    contents = await file.read()
    result = analyze_image_basic(contents)
    return {"status": "success", "result": result}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=7860)
