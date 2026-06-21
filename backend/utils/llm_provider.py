import os

from dotenv import load_dotenv

from botocore.config import Config



from langchain_openai import ChatOpenAI, AzureChatOpenAI

from langchain_aws import ChatBedrockConverse

from langchain_anthropic import ChatAnthropic

from langchain_core.language_models.chat_models import BaseChatModel



load_dotenv()  # Load env variables from .env

KIMI_DEFAULT_BASE_URL = "https://api.moonshot.cn/v1"
# Legacy / shorthand IDs → official Moonshot model names
KIMI_MODEL_ALIASES = {
    "k2-6": "kimi-k2.6",
    "kimi-k2-6": "kimi-k2.6",
    "kimi-k2.6-thinking": "kimi-k2.6-thinking",
}


def _resolve_kimi_model_id(model_id: str, thinking_enabled: bool) -> str:
    resolved = KIMI_MODEL_ALIASES.get(model_id, model_id)
    if thinking_enabled and resolved == "kimi-k2.6":
        return "kimi-k2.6-thinking"
    return resolved


def get_llm(agent: str, temperature: float = 0.0, max_tokens: int = 2000, thinking_enabled: bool = False) -> BaseChatModel:

    """

    Get an LLM instance based on agent name and environment variables.



    Args:

        agent (str): Logical name of the agent, e.g., "planner", "suggestor", "computer_use", "classifier", "title"

        temperature (float): Sampling temperature

        max_tokens (int): Optional token limit



    Returns:

        langchain-compatible LLM object

    """

    model_type = os.getenv(f"{agent.upper()}_AGENT_MODEL_TYPE")

    model_id = os.getenv(f"{agent.upper()}_AGENT_MODEL_ID")



    if not model_type or not model_id:

        raise ValueError(f"Missing model config for agent: {agent}")



    if model_type == "azure_openai":

        return AzureChatOpenAI(

            azure_deployment=model_id,

            api_version=os.getenv("OPENAI_API_VERSION", "2024-12-01-preview"),

            temperature=temperature,

            max_tokens=max_tokens,

            timeout=None,

            max_retries=2

        )

    

    elif model_type == "openai":

        base_url = os.getenv("OPENAI_BASE_URL")

        kwargs = {

            "model": model_id,

            "temperature": temperature,

            "max_tokens": max_tokens,

            "timeout": None,

            "max_retries": 2

        }

        if base_url:

            kwargs["base_url"] = base_url

        return ChatOpenAI(**kwargs)



    elif model_type == "kimi":
        kimi_api_key = os.getenv("KIMI_API_KEY")
        if not kimi_api_key:
            raise ValueError(
                "KIMI_API_KEY is required when using model type 'kimi'. "
                "Get a key at https://platform.moonshot.cn"
            )
        kimi_base_url = os.getenv("KIMI_BASE_URL", KIMI_DEFAULT_BASE_URL)
        resolved_model = _resolve_kimi_model_id(model_id, thinking_enabled)
        return ChatOpenAI(
            model=resolved_model,
            api_key=kimi_api_key,
            base_url=kimi_base_url,
            temperature=1.0,  # Requis par Kimi K2.x
            max_tokens=max_tokens,
            timeout=None,
            max_retries=2,
        )

    elif model_type == "deepseek":
        deepseek_base_url = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1")
        deepseek_api_key = os.getenv("DEEPSEEK_API_KEY")
        kwargs = {
            "model": model_id,
            "temperature": 1.0,  # DeepSeek performs better with temperature=1.0
            "max_tokens": max_tokens,
            "timeout": None,
            "max_retries": 2
        }
        if deepseek_base_url:
            kwargs["base_url"] = deepseek_base_url
        if deepseek_api_key:
            kwargs["api_key"] = deepseek_api_key
        return ChatOpenAI(**kwargs)

    elif model_type == "openrouter":
        openrouter_api_key = os.getenv("OPENROUTER_API_KEY")
        if not openrouter_api_key:
            raise ValueError(
                "OPENROUTER_API_KEY is required when using model type 'openrouter'. "
                "Get a key at https://openrouter.ai/keys"
            )
        return ChatOpenAI(
            model=model_id,
            api_key=openrouter_api_key,
            base_url="https://openrouter.ai/api/v1",
            temperature=temperature,
            max_tokens=max_tokens,
            timeout=None,
            max_retries=2,
            default_headers={
                "HTTP-Referer": "https://localhost:8000",
                "X-Title": "ZimZamZum Local Dev"
            }
        )

    elif model_type == "mistral":
        mistral_api_key = os.getenv("MISTRAL_API_KEY")
        if not mistral_api_key:
            raise ValueError(
                "MISTRAL_API_KEY is required when using model type 'mistral'. "
                "Get a key at https://console.mistral.ai/api-keys/"
            )
        return ChatOpenAI(
            model=model_id,
            api_key=mistral_api_key,
            base_url="https://api.mistral.ai/v1",
            temperature=temperature,
            max_tokens=max_tokens,
            timeout=None,
            max_retries=2,
        )

    elif model_type == "gemini":
        gemini_api_key = os.getenv("GEMINI_API_KEY")
        gemini_base_url = os.getenv("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai/")
        if not gemini_api_key:
            raise ValueError(
                "GEMINI_API_KEY is required when using model type 'gemini'. "
                "Get a key at https://aistudio.google.com/apikey"
            )
        return ChatOpenAI(
            model=model_id,
            api_key=gemini_api_key,
            base_url=gemini_base_url,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout=None,
            max_retries=2,
        )

    elif model_type == "apiyi":
        apiyi_api_key = os.getenv("APIYI_API_KEY")
        apiyi_base_url = os.getenv("APIYI_BASE_URL", "https://api.apiyi.com/v1/openai/")
        if not apiyi_api_key:
            raise ValueError(
                "APIYI_API_KEY is required when using model type 'apiyi'. "
                "Get a key at https://apiyi.com"
            )
        return ChatOpenAI(
            model=model_id,
            api_key=apiyi_api_key,
            base_url=apiyi_base_url,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout=None,
            max_retries=2,
        )

    elif model_type == "anthropic":
        anthropic_api_key = os.getenv("ANTHROPIC_API_KEY")
        anthropic_base_url = os.getenv("ANTHROPIC_BASE_URL")
        if not anthropic_api_key:
            raise ValueError(
                "ANTHROPIC_API_KEY is required when using model type 'anthropic'. "
                "Get a key at https://console.anthropic.com/settings/keys"
            )

        if not thinking_enabled:

            return ChatAnthropic(

                model=model_id,
                api_key=anthropic_api_key,
                base_url=anthropic_base_url,

                temperature=temperature,

                max_tokens=max_tokens,

                timeout=None,

                max_retries=2,

            )

        else:

            return ChatAnthropic(

                model=model_id,
                api_key=anthropic_api_key,
                base_url=anthropic_base_url,

                temperature=temperature,

                max_tokens=max_tokens,

                timeout=None,

                max_retries=2,

                thinking={"type": "enabled", "budget_tokens": 2000},

            )



    elif model_type == "bedrock":

        thinking_params = {

            "thinking": {

                "type": "enabled",

                "budget_tokens": 2000

            }

        }

        boto3_config = Config(

            connect_timeout=300,

            read_timeout=300,

            retries={'max_attempts': 5},

            region_name=os.getenv("BEDROCK_REGION", "us-east-1")

        )

        if thinking_enabled and 'claude' in model_id:

            return ChatBedrockConverse(

                model=model_id,

                temperature=temperature,

                max_tokens=max_tokens,

                config=boto3_config,

                region_name=os.getenv("BEDROCK_REGION", "us-east-1"),

                additional_model_request_fields=thinking_params

            )

        else:

            return ChatBedrockConverse(

                model=model_id,

                temperature=temperature,

                max_tokens=max_tokens,

                config=boto3_config,

                region_name=os.getenv("BEDROCK_REGION", "us-east-1")

            )



    else:

        raise ValueError(f"Unsupported model type '{model_type}' for agent '{agent}'")

