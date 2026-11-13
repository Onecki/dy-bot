"""验证 MaiBot 实际 Gemini 客户端的生成和文本向量接口；不发送群消息。"""
from pathlib import Path

import asyncio
import os
import sys

ROOT = Path(__file__).resolve().parent.parent
os.chdir(ROOT / "maibot")
sys.path.insert(0, str(ROOT / "maibot"))
from src.config.config import model_config
from src.llm_models.model_client.base_client import EmbeddingRequest, ResponseRequest
from src.llm_models.model_client.gemini_client import GeminiClient
from src.llm_models.payload_content.context_item import ContextItemBuilder, ContextItemMeta, RoleType
from src.llm_models.payload_content.tool_option import ToolOption

async def main() -> None:
    client = GeminiClient(model_config.api_providers[0])
    chat, embed = model_config.models
    response = await client.get_response(ResponseRequest(model_info=chat,context_items=[ContextItemBuilder().add_text_part("请用中文简短回复：模型连接正常").build()],max_tokens=256))
    assert response.content
    print("MAIBOT_GENERATION_PASS", response.content)
    vector = await client.get_embedding(EmbeddingRequest(model_info=embed,embedding_input="群友喜欢清淡食物",extra_params={"output_dimensionality":768}))
    assert len(vector.embedding) == 768
    print("MAIBOT_EMBEDDING_PASS dimensions=768")
    user = ContextItemBuilder().add_text_part("必须先调用 get_test_value 工具取得测试值，再用中文告诉我结果。").build()
    tool = ToolOption(name="get_test_value",description="返回验证模型工具接口所需的测试值",parameters_schema_override={"type":"object","properties":{}})
    tool_request = ResponseRequest(model_info=chat,context_items=[user],tool_options=[tool],max_tokens=1024)
    called = await client.get_response(tool_request)
    assert called.tool_calls, "模型未调用测试工具"
    call = called.tool_calls[0]
    result = ContextItemBuilder().set_role(RoleType.Tool).set_meta(ContextItemMeta.create(logical_turn_id=tool_request.logical_turn_id)).set_tool_call_id(call.call_id).set_tool_name(call.func_name).add_text_part('{"value": 7}').build()
    continued = await client.get_response(ResponseRequest(model_info=chat,context_items=[user,*called.output_items,result],tool_options=[tool],max_tokens=1024))
    assert continued.content and "7" in continued.content
    print("MAIBOT_TOOL_ROUNDTRIP_PASS", continued.content)
    await client.client.aio.aclose()

asyncio.run(main())
