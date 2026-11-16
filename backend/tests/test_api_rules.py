from pathlib import Path

from fastapi.routing import APIRoute

from backend.main import app

ROOT = Path(__file__).resolve().parents[2]


def test_every_operation_has_an_id_and_a_one_line_docstring():
    for route in app.routes:
        if isinstance(route, APIRoute):
            assert route.operation_id == route.name, route.path
            doc = (route.endpoint.__doc__ or "").strip()
            assert doc, route.path
            assert "\n" not in doc, route.path


def test_no_operation_has_an_optional_input(client):
    schema = client.get("/openapi.json").json()
    models = schema.get("components", {}).get("schemas", {})
    for path, operations in schema["paths"].items():
        for operation in operations.values():
            for parameter in operation.get("parameters", []):
                assert parameter["required"], (path, parameter["name"])
            body = operation.get("requestBody")
            if body:
                assert body["required"], path
                ref = body["content"]["application/json"]["schema"]["$ref"]
                model = models[ref.split("/")[-1]]
                assert set(model["properties"]) == set(model["required"]), path


def product_code(folder: str) -> str:
    files = [
        file
        for file in (ROOT / folder).rglob("*")
        if file.suffix in {".py", ".md"} and "tests" not in file.parts
    ]
    return "\n".join(file.read_text(encoding="utf-8") for file in files)


def test_the_backend_never_reaches_the_answer_key():
    assert "evals" not in product_code("backend")


def test_the_agent_reaches_data_only_through_the_backend():
    code = product_code("agent")
    assert "data/" not in code
    assert "evals" not in code
