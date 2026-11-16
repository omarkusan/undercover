import importlib

from langchain_core.language_models.fake_chat_models import GenericFakeChatModel
from langchain_core.messages import AIMessage, BaseMessage, ToolMessage
from pydantic import Field

from agent import main

cli = importlib.import_module("agent.__main__")


class StubModel(GenericFakeChatModel):
    """A chat model that gives scripted replies and keeps what it was sent."""

    received: list[list[BaseMessage]] = Field(default_factory=list)

    def bind_tools(self, tools, **kwargs):
        return self

    def _generate(self, messages, *args, **kwargs):
        self.received.append(messages)
        return super()._generate(messages, *args, **kwargs)


def call(name, **args):
    return AIMessage(
        content="", tool_calls=[{"name": name, "args": args, "id": f"call-{name}"}]
    )


def decision(decision, payout):
    return call(
        "decide_claim",
        claim_id="CLM-1001",
        decision=decision,
        payout=payout,
        reasons="The flight was canceled and the receipts cover the costs.",
        policy_section="Section 3, Trip Delay",
    )


def reads():
    return [
        call("get_claim", claim_id="CLM-1001"),
        call("get_policy", policy_id="POL-2001"),
        call("get_claim_history", customer_id="CUS-3001"),
    ]


def stub(*replies):
    return StubModel(messages=iter(replies))


def test_an_approval_within_the_limit_is_paid(client):
    model = stub(
        *reads(),
        decision("approve", 420.0),
        call("pay_claim", claim_id="CLM-1001", amount=420.0),
        AIMessage(content="Approved and paid $420.00."),
    )
    assert main.run("CLM-1001", "thread-1", model) == "Approved and paid $420.00."
    claim = client.get("/api/claims/CLM-1001").json()
    assert claim["status"] == "decided"
    assert claim["thread_id"] == "thread-1"
    assert claim["paid_amount"] == 420.0
    steps = client.get("/api/claims/CLM-1001/steps").json()
    assert [step["kind"] for step in steps] == [
        *["tool_call", "tool_result"] * 5,
        "message",
    ]
    assert steps[0]["text"] == 'get_claim {"claim_id": "CLM-1001"}'
    assert steps[1]["text"].startswith('get_claim returned {"claim_id":"CLM-1001"')
    assert steps[-1]["text"] == "Approved and paid $420.00."
    assert {step["thread_id"] for step in steps} == {"thread-1"}


def test_the_payment_is_blocked_when_the_agent_pays_over_the_limit(client):
    model = stub(
        *reads(),
        decision("approve", 1250.0),
        call("pay_claim", claim_id="CLM-1001", amount=1250.0),
        AIMessage(content="Approved $1,250.00."),
    )
    main.run("CLM-1001", "thread-1", model)
    claim = client.get("/api/claims/CLM-1001").json()
    assert claim["status"] == "waiting_for_sign_off"
    assert claim["paid_amount"] is None
    payment_result = model.received[-1][-1]
    assert isinstance(payment_result, ToolMessage)
    assert "needs a handler's sign-off" in payment_result.text


def test_a_decline_pays_nothing(client):
    model = stub(*reads(), decision("decline", 0), AIMessage(content="Declined."))
    main.run("CLM-1001", "thread-1", model)
    claim = client.get("/api/claims/CLM-1001").json()
    assert claim["status"] == "decided"
    assert claim["decision"] == "decline"
    assert claim["payout"] == 0
    assert claim["paid_amount"] is None


def test_the_agent_works_from_the_instructions_the_backend_serves(client):
    model = stub(AIMessage(content="Done."))
    main.run("CLM-1001", "thread-1", model)
    system = model.received[0][0]
    instructions = client.get("/api/instructions").json()["instructions"]
    assert system.type == "system"
    assert system.text == instructions
    assert "You are the UnderCover Agent." in instructions
    assert "## 10. How we work out your payment" in instructions


def test_a_model_reply_with_text_and_tool_calls_is_two_steps():
    message = AIMessage(
        content="Let me read the claim.",
        tool_calls=[{"name": "get_claim", "args": {"claim_id": "C"}, "id": "1"}],
    )
    assert main.describe(message) == [
        ("message", "Let me read the claim."),
        ("tool_call", 'get_claim {"claim_id": "C"}'),
    ]


def test_the_command_line_runs_one_claim(client, monkeypatch, capsys):
    runs = []

    def fake_run(claim_id, thread_id):
        runs.append((claim_id, thread_id))
        client.post(f"/api/claims/{claim_id}/start", json={"thread_id": thread_id})
        return "Still working."

    monkeypatch.setattr(main, "run", fake_run)
    cli.decide("CLM-1001")
    assert [claim_id for claim_id, _ in runs] == ["CLM-1001"]
    assert capsys.readouterr().out == (
        "CLM-1001  no decision    in_progress\nStill working.\n"
    )


def test_the_summary_shows_the_payout():
    claim = {
        "claim_id": "CLM-1002",
        "decision": "approve",
        "payout": 1150.0,
        "status": "waiting_for_sign_off",
    }
    assert cli.summary(claim) == "CLM-1002  approve  $1,150.00  waiting_for_sign_off"


def test_model_name(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.delenv("MODEL_NAME", raising=False)
    assert main.model().model_name == "openai/gpt-6-luna"
    monkeypatch.setenv("MODEL_NAME", "openrouter/free")
    assert main.model().model_name == "openrouter/free"
