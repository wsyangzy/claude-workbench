import os

# 定义 .qwen 目录路径
QWEN_DIR = os.path.expanduser("~/.qwen")
ENV_FILE = os.path.join(QWEN_DIR, ".env")

if os.path.exists(ENV_FILE):
    with open(ENV_FILE, 'r', encoding='utf-8') as f:
        content = f.read()
    print("当前 .env 文件内容:")
    print(content)
else:
    print(".env 文件不存在")