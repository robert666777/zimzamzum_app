import datetime
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from routers.apps.auth import router as userauth_router
from routers.aiagent.generic import router as aiagent_router
from routers.apps.threads import router as threads_router
from routers.aiagent.suggestor import router as suggestor_aiagent_router
from routers.aiagent.background import router as bg_mode_aiagent_router
from routers.automations import automations_router
from routers.apps.referrals import router as referrals_router
from routers.apps.payments import router as payments_router
from utils.procedures import CustomError

from dotenv import load_dotenv
load_dotenv()

app = FastAPI(
    title='NeuralAgent'
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        '*',
    ],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


@app.exception_handler(CustomError)
async def custom_http_exception_handler(request: Request, exc: CustomError):
    return JSONResponse(
        status_code=exc.status_code,
        content={'message': exc.message},
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    import traceback
    error_detail = {
        'type': type(exc).__name__,
        'message': str(exc),
        'traceback': traceback.format_exc()
    }
    print("=== ERREUR DÉTAILLÉE ===")
    print(error_detail)
    print("========================")
    return JSONResponse(
        status_code=500,
        content={'message': str(exc), 'detail': error_detail},
    )


app.include_router(userauth_router)
app.include_router(threads_router)
app.include_router(suggestor_aiagent_router)
app.include_router(bg_mode_aiagent_router)
app.include_router(aiagent_router)
app.include_router(automations_router)
app.include_router(referrals_router)
app.include_router(payments_router)

# @app.on_event('startup')
# async def startup():
#     await broadcast.connect()
#
#
# @app.on_event('shutdown')
# async def shutdown():
#     await broadcast.disconnect()


@app.get('/')
async def index():
    return {'message': datetime.datetime.now()}
