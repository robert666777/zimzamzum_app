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
        deepseek_base_url = os.getenv("DEEPSEEK_BASE_URL")
        deepseek_api_key = os.getenv("DEEPSEEK_API_KEY")
        kwargs = {
            "model": model_id,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "timeout": None,
            "max_retries": 2
        }
        if deepseek_base_url:
            kwargs["base_url"] = deepseek_base_url
        if deepseek_api_key:
            kwargs["api_key"] = deepseek_api_key
        return ChatOpenAI(**kwargs)

    elif model_type == "anthropic":

        if not thinking_enabled:

            return ChatAnthropic(

                model=model_id,

                temperature=temperature,

                max_tokens=max_tokens,

                timeout=None,

                max_retries=2,

            )

        else:

            return ChatAnthropic(

                model=model_id,

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

