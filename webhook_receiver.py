import json
from fastapi import FastAPI, Request

app = FastAPI()


@app.post("/webhook")
async def webhook(request: Request):
    data = await request.json()
    print("[Webhook] Received alert:", json.dumps(data, indent=2))
    return {"status": "received"}


if __name__ == "__main__":
    import uvicorn

    print("[INFO] Starting webhook receiver at http://127.0.0.1:9000 ...")
    uvicorn.run(app, host="127.0.0.1", port=9000)
