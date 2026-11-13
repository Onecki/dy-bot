"""为固定版本的本地 MaiBot 实例配置模型、身份、记忆及平台白名单。"""
from pathlib import Path

import json
import sys
import tomlkit

ROOT = Path(__file__).resolve().parent.parent
INSTANCE = ROOT / "maibot"
model = json.loads((ROOT / "config/model.local.json").read_text(encoding="utf-8"))
local = json.loads((ROOT / "config/local.json").read_text(encoding="utf-8"))
bridge_path = ROOT / "config/maibot.local.json"
bridge = json.loads(bridge_path.read_text(encoding="utf-8"))
if model.get("adapterType") != "gemini" or not model.get("apiKey") or not model.get("model"):
    raise SystemExit("请先填写 config/model.local.json 的 Gemini 密钥和模型名。其他模型服务请在 MaiBot 中单独配置。")
if not bridge.get("accountId") or not bridge.get("token") or not local.get("allowedGroups"):
    raise SystemExit("请先登录并填写 accountId、allowedGroups 和 groupNames。")
model_path = INSTANCE / "config/model_config.toml"
models = tomlkit.parse(model_path.read_text(encoding="utf-8"))
if any(item.get("name") == "dybot-gemini" for item in models.get("api_providers", [])) and "--overwrite" not in sys.argv:
    raise SystemExit("MaiBot 已配置。为保护现有人设与模型设置，不重复覆盖；确需重新初始化时加 --overwrite。")
dimensions = int(model.get("embeddingDimensions", 768))
if dimensions < 1:
    raise SystemExit("embeddingDimensions 必须为正整数。")

bot_path = INSTANCE / "config/bot_config.toml"
bot = tomlkit.parse(bot_path.read_text(encoding="utf-8"))
bot_name = model.get("botName", "小抖")
bot["bot"].update({"platform": "douyin", "platforms": ["douyin:" + bridge["accountId"]], "nickname": bot_name, "alias_names": [bot_name]})
bot["personality"].update({
    "personality": f"你是粉丝群里的AI群友{bot_name}，友善、有自己的想法，喜欢自然地参与大家的话题。",
    "behavior_style": "先理解大家在聊什么，分清谁在对谁说话。被叫到时认真回应，有相关想法时适度参与，不硬找话题，不连续插嘴。记忆用于理解群友，不公开不相关的个人信息。",
    "reply_style": "像日常群聊一样用简洁自然的中文交流，通常一到三句，少用列表、套话和反复追问。需要解释时再展开，不编造经历或群友说过的话。",
    "multiple_probability": 0,
})
bot["chat"]["enable_reply_at"] = False
bot["chat"]["max_context_size"] = 30
bot["chat"]["reply_timing"].update({"talk_value": 0.5, "inevitable_at_reply": True, "message_debounce_mode": "natural"})
bot["maim_message"].update({"enabled": True, "ws_server_host": "127.0.0.1", "ws_server_port": 18000, "auth_token": [bridge["token"]], "enable_api_server": False})
bot["webui"].update({"enabled": True, "host": ["127.0.0.1"], "port": 18001})
bot["telemetry"]["enable"] = False
bot["debug"]["enable_console_input"] = False
bot["response_splitter"]["enable"] = False
bot["chinese_typo"]["enable"] = False
bot["mcp"]["enable"] = False
bot["a_memorix"]["plugin"]["enabled"] = True
bot["a_memorix"]["image_memory"]["enabled"] = False
bot["a_memorix"]["embedding"].update({"model_name": "dybot-embedding", "dimension": dimensions, "dimension_request_mode": "always", "max_concurrent": 1})
bot["a_memorix"]["integration"].update({"person_fact_writeback_enabled": True, "chat_summary_writeback_enabled": True, "chat_summary_writeback_message_threshold": 36})
bot_path.write_text(tomlkit.dumps(bot), encoding="utf-8")

models["api_providers"] = [{"name": "dybot-gemini", "base_url": model["baseUrl"], "api_key": model["apiKey"], "client_type": "gemini", "max_retry": 1, "timeout": 60}]
models["models"] = [
    {"name": "dybot-chat", "model_identifier": model["model"], "model_type": "llm", "api_provider": "dybot-gemini", "price_in": 0.0, "price_out": 0.0, "visual": False},
    {"name": "dybot-embedding", "model_identifier": model.get("embeddingModel", "gemini-embedding-001"), "model_type": "embedding", "api_provider": "dybot-gemini", "price_in": 0.0, "price_out": 0.0, "extra_params": {"output_dimensionality": dimensions}},
]
for name, task in models["model_task_config"].items():
    if name in {"replyer", "planner", "utils", "memory", "mid_memory", "learner", "fast_model"}:
        task.update({"model_list": ["dybot-chat"], "max_tokens": 8192 if name == "planner" else 4096, "hard_timeout": 90.0})
    elif name == "embedding":
        task["model_list"] = ["dybot-embedding"]
    elif "model_list" in task:
        task["model_list"] = []
model_path.write_text(tomlkit.dumps(models), encoding="utf-8")

policy = {"default_action": "block", "adapters": [{
    "platform": "douyin", "account_id": bridge["accountId"],
    "group": {"list_type": "whitelist", "ids": local["allowedGroups"]},
    "private": {"list_type": "whitelist", "ids": []},
}]}
(INSTANCE / "config/adapter_policy.toml").write_text(tomlkit.dumps(policy), encoding="utf-8")
print(f"MaiBot 模型、{dimensions}维文本记忆、目标群白名单和本机端口已配置。请检查 observeOnly 和 enabled 后再启动网关。")
