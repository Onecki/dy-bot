"""使用实际 maim-message 0.6.8 测试桥接，完全不连接抖音或模型。"""
from maim_message import MessageBase, MessageServer

import asyncio
import json
import sys
import time

async def main() -> None:
    server = MessageServer(host="127.0.0.1", port=int(sys.argv[1]), enable_token=True)
    server.add_valid_token("integration-test-token")

    async def inbound(message: dict) -> None:
        parsed = MessageBase.from_dict(message)
        assert parsed.message_info.platform == "douyin"
        assert parsed.message_info.group_info.group_id == "9000000000000000001"
        info = dict(message["message_info"])
        info.update({"message_id": "test-reply-1", "time": time.time()})
        await server.broadcast_to_platform("douyin", {"message_info": info, "message_segment": {"type": "text", "data": "官方协议联调通过"}})

    async def echo(message: dict) -> None:
        assert message["content"]["actual_id"] == "douyin-real-id"
        print("ECHO_PASS", flush=True)

    server.register_message_handler(inbound)
    server.register_custom_message_handler("message_id_echo", echo)
    await server.run()

asyncio.run(main())
