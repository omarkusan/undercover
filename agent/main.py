"""The UnderCover Agent."""

import json
import os
from typing import Literal

import httpx
from dotenv import load_dotenv
from langchain.agents import create_agent
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage, ToolMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from pydantic import SecretStr

load_dotenv(override=True)

BACKEND_URL = "http://localhost:8000"
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
DEFAULT_MODEL = "openai/gpt-6-luna"


def backend() -> httpx.Client:
    """Return a client for the UnderCover backend."""
    return httpx.Client(base_url=BACKEND_URL, timeout=30)


@tool
def get_claim(claim_id: str) -> str:
    """Get a claim: the customer's story, the items claimed and the documents."""
    with backend() as client:
        return client.get(f"/api/claims/{claim_id}").text


@tool
def get_policy(policy_id: str) -> str:
    """Get a policy: the plan, add-ons, purchase date, trip dates and travelers."""
    with backend() as client:
        return client.get(f"/api/policies/{policy_id}").text


@tool
def get_claim_history(customer_id: str) -> str:
    """Get a customer's earlier claims."""
    with backend() as client:
        return client.get(f"/api/customers/{customer_id}/claims").text


@tool
def decide_claim(
    claim_id: str,
    decision: Literal["approve", "decline", "refer"],
    payout: float,
    reasons: str,
    policy_section: str,
) -> str:
    """Record your decision on a claim, its payout, reasons and policy section."""
    with backend() as client:
        return client.post(
            f"/api/claims/{claim_id}/decision",
            json={
                "decision": decision,
                "payout": payout,
                "reasons": reasons,
                "policy_section": policy_section,
            },
        ).text


@tool
def pay_claim(claim_id: str, amount: float) -> str:
    """Pay an approved claim its payout."""
    with backend() as client:
        return client.post(
            f"/api/claims/{claim_id}/payment", json={"amount": amount}
        ).text


TOOLS = [get_claim, get_policy, get_claim_history, decide_claim, pay_claim]


def model() -> ChatOpenAI:
    """Return the model named in MODEL_NAME, or GPT-6 Luna by default."""
    name = os.getenv("MODEL_NAME")
    return ChatOpenAI(
        model=name or DEFAULT_MODEL,
        base_url=OPENROUTER_BASE_URL,
        api_key=SecretStr(os.environ["OPENROUTER_API_KEY"]),
        reasoning_effort=None if name else "low",
    )


def describe(message: BaseMessage) -> list[tuple[str, str]]:
    """Turn a message from the agent into the steps a handler sees."""
    if isinstance(message, ToolMessage):
        return [("tool_result", f"{message.name} returned {message.text}")]
    steps = [("message", str(message.text))] if message.text else []
    calls = message.tool_calls if isinstance(message, AIMessage) else []
    return steps + [
        ("tool_call", f"{call['name']} {json.dumps(call['args'])}") for call in calls
    ]


def report(client: httpx.Client, claim_id: str, thread_id: str, message: BaseMessage):
    """Send the steps in a message to the backend."""
    for kind, text in describe(message):
        client.post(
            f"/api/claims/{claim_id}/steps",
            json={"thread_id": thread_id, "kind": kind, "text": text},
        ).raise_for_status()


def run(claim_id: str, thread_id: str, llm: BaseChatModel | None = None) -> str:
    """Run the agent on one claim and return its final reply."""
    reply = ""
    with backend() as client:
        instructions = client.get("/api/instructions").raise_for_status().json()
        client.post(
            f"/api/claims/{claim_id}/start", json={"thread_id": thread_id}
        ).raise_for_status()
        agent = create_agent(
            llm or model(), tools=TOOLS, system_prompt=instructions["instructions"]
        )
        for update in agent.stream(
            {"messages": [{"role": "user", "content": f"Decide claim {claim_id}."}]},
            config={"configurable": {"thread_id": thread_id}},
            stream_mode="updates",
        ):
            for node in update.values():
                for message in node["messages"]:
                    report(client, claim_id, thread_id, message)
                    reply = message.text
    return reply
