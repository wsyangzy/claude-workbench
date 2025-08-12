import os
import sys
import json
import re

# 设置控制台编码为UTF-8
sys.stdout.reconfigure(encoding='utf-8')

# 定义 .qwen 和 .claude 目录路径
QWEN_DIR = os.path.expanduser("~/.qwen")
CLAUDE_DIR = os.path.expanduser("~/.claude")
QWEN_ENV_FILE = os.path.join(QWEN_DIR, ".env")
CLAUDE_SETTINGS_FILE = os.path.join(CLAUDE_DIR, "settings.json")

# 当前脚本所在目录
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_FILE = os.path.join(SCRIPT_DIR, "env.config")

def parse_key_value_config(content):
    """解析键值对配置内容"""
    env_dict = {}
    for line in content.split('\n'):
        if '=' in line:
            key, value = line.split('=', 1)
            env_dict[key.strip()] = value.strip().strip('"')
    return env_dict

def parse_config_file():
    """解析配置文件，返回环境配置字典"""
    if not os.path.exists(CONFIG_FILE):
        print(f"配置文件 {CONFIG_FILE} 不存在")
        return {}
    
    try:
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 使用正则表达式提取Qwen环境配置
        qwen_pattern = r'\[qwen:([^\]]+)\](.*?)(?=\[qwen:|\[claude:|\Z)'
        qwen_matches = re.findall(qwen_pattern, content, re.DOTALL)
        
        # 使用正则表达式提取Claude环境配置
        claude_pattern = r'\[claude:([^\]]+)\](.*?)(?=\[qwen:|\[claude:|\Z)'
        claude_matches = re.findall(claude_pattern, content, re.DOTALL)
        
        configs = {
            'qwen': {},
            'claude': {}
        }
        
        # 解析Qwen配置
        for env_name, env_content in qwen_matches:
            env_content = env_content.strip()
            configs['qwen'][env_name] = parse_key_value_config(env_content)
        
        # 解析Claude配置
        for env_name, env_content in claude_matches:
            env_content = env_content.strip()
            configs['claude'][env_name] = parse_key_value_config(env_content)
        
        return configs
    except Exception as e:
        print(f"解析配置文件失败: {e}")
        return {}

def get_current_env_by_comparison(env_file, configs, key_fields):
    """通用的环境检测函数"""
    if not os.path.exists(env_file):
        return None
    
    try:
        # 读取当前配置
        if env_file.endswith('.json'):
            with open(env_file, 'r', encoding='utf-8') as f:
                settings = json.load(f)
            current_config = settings.get('env', {})
        else:
            with open(env_file, 'r', encoding='utf-8') as f:
                content = f.read().strip()
            current_config = parse_key_value_config(content)
        
        # 比较找到匹配的配置
        for env_name, env_config in configs.items():
            if all(current_config.get(key, '') == env_config.get(key, '') for key in key_fields):
                return env_name
        return "custom"
    except Exception:
        return None

def get_current_qwen_env(qwen_configs):
    """获取当前使用的Qwen环境配置"""
    return get_current_env_by_comparison(
        QWEN_ENV_FILE, 
        qwen_configs, 
        ['OPENAI_BASE_URL', 'OPENAI_API_KEY', 'OPENAI_MODEL']
    )

def get_current_claude_env(claude_configs):
    """获取当前使用的Claude环境配置"""
    return get_current_env_by_comparison(
        CLAUDE_SETTINGS_FILE, 
        claude_configs, 
        ['ANTHROPIC_BASE_URL', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_MODEL']
    )

def switch_qwen_env(env_name, qwen_configs):
    """将指定的Qwen环境配置写入到 .env 文件"""
    if env_name not in qwen_configs:
        print(f"Qwen环境 {env_name} 不存在")
        return False
    
    try:
        # 确保目标目录存在
        if not os.path.exists(QWEN_DIR):
            os.makedirs(QWEN_DIR)
            print(f"已创建目录: {QWEN_DIR}")
        
        # 构建.env文件内容
        env_config = qwen_configs[env_name]
        env_lines = []
        
        if 'OPENAI_BASE_URL' in env_config:
            env_lines.append(f"OPENAI_BASE_URL={env_config['OPENAI_BASE_URL']}")
        if 'OPENAI_API_KEY' in env_config:
            env_lines.append(f"OPENAI_API_KEY={env_config['OPENAI_API_KEY']}")
        if 'OPENAI_MODEL' in env_config:
            env_lines.append(f"OPENAI_MODEL={env_config['OPENAI_MODEL']}")
        
        env_content = "\n".join(env_lines)
        
        # 写入到 .env 文件
        with open(QWEN_ENV_FILE, 'w', encoding='utf-8') as f:
            f.write(env_content)
        
        print(f"成功切换Qwen环境到 {env_name}")
        return True
    except Exception as e:
        print(f"Qwen环境切换失败: {e}")
        return False

def switch_claude_env(env_name, claude_configs):
    """将指定的Claude环境配置写入到 settings.json 文件"""
    if env_name not in claude_configs:
        print(f"Claude环境 {env_name} 不存在")
        return False
    
    try:
        # 确保目标目录存在
        if not os.path.exists(CLAUDE_DIR):
            os.makedirs(CLAUDE_DIR)
            print(f"已创建目录: {CLAUDE_DIR}")
        
        # 获取当前设置或创建默认结构
        if os.path.exists(CLAUDE_SETTINGS_FILE):
            with open(CLAUDE_SETTINGS_FILE, 'r', encoding='utf-8') as f:
                settings = json.load(f)
        else:
            # 创建默认结构
            settings = {
                "env": {},
                "permissions": {
                    "allow": [],
                    "deny": []
                }
            }
        
        # 确保env对象存在
        if 'env' not in settings:
            settings['env'] = {}
            
        # 更新环境设置
        env_config = claude_configs[env_name]
        if 'ANTHROPIC_BASE_URL' in env_config:
            settings['env']['ANTHROPIC_BASE_URL'] = env_config['ANTHROPIC_BASE_URL']
        if 'ANTHROPIC_AUTH_TOKEN' in env_config:
            settings['env']['ANTHROPIC_AUTH_TOKEN'] = env_config['ANTHROPIC_AUTH_TOKEN']
        
        # 处理ANTHROPIC_MODEL：如果新配置中有则设置，如果没有则删除
        if 'ANTHROPIC_MODEL' in env_config:
            settings['env']['ANTHROPIC_MODEL'] = env_config['ANTHROPIC_MODEL']
        else:
            # 如果新配置中没有ANTHROPIC_MODEL，删除现有的ANTHROPIC_MODEL设置
            if 'ANTHROPIC_MODEL' in settings['env']:
                del settings['env']['ANTHROPIC_MODEL']
        
        # 写入到 settings.json 文件
        with open(CLAUDE_SETTINGS_FILE, 'w', encoding='utf-8') as f:
            json.dump(settings, f, indent=2, ensure_ascii=False)
        
        print(f"成功切换Claude环境到 {env_name}")
        return True
    except Exception as e:
        print(f"Claude环境切换失败: {e}")
        return False

def show_main_menu():
    """显示主菜单"""
    print("\n选择要切换的环境类型:")
    print("1. Qwen环境")
    print("2. Claude环境")
    print("\n3. 添加新配置")
    print("0. 退出")

def show_qwen_menu(qwen_configs):
    """显示Qwen环境菜单"""
    current_env = get_current_qwen_env(qwen_configs)
    print("\n可用的Qwen环境配置:")
    env_names = list(qwen_configs.keys())
    for i, env_name in enumerate(env_names, 1):
        marker = " (*)" if env_name == current_env else ""
        print(f"{i}. {env_name}{marker}")
    
    if current_env and current_env != "custom":
        print(f"\n当前Qwen环境: {current_env}")
    elif current_env == "custom":
        print("\n当前Qwen环境: 自定义配置")
    else:
        print("\n当前Qwen环境: 未设置")
    
    print("0. 返回上一级")
    return env_names

def show_claude_menu(claude_configs):
    """显示Claude环境菜单"""
    current_env = get_current_claude_env(claude_configs)
    print("\n可用的Claude环境配置:")
    env_names = list(claude_configs.keys())
    for i, env_name in enumerate(env_names, 1):
        marker = " (*)" if env_name == current_env else ""
        print(f"{i}. {env_name}{marker}")
    
    if current_env and current_env != "custom":
        print(f"\n当前Claude环境: {current_env}")
    elif current_env == "custom":
        print("\n当前Claude环境: 自定义配置")
    else:
        print("\n当前Claude环境: 未设置")
    
    print("0. 返回上一级")
    return env_names

def add_config_generic(configs, config_type, env_name, config_fields):
    """通用的添加配置函数"""
    if env_name in configs[config_type]:
        print(f"{config_type.capitalize()}环境 {env_name} 已存在")
        return configs
    
    config_dict = {}
    required_fields = []
    
    for field_name, field_info in config_fields.items():
        prompt = field_info.get('prompt', f"请输入{field_name}: ")
        is_required = field_info.get('required', True)
        
        value = input(prompt).strip()
        
        if is_required and not value:
            missing_fields = [name for name, info in config_fields.items() if info.get('required', True)]
            print(f"必填字段不能为空: {', '.join(missing_fields)}")
            return configs
        
        if value:
            config_dict[field_name] = value
        
        if is_required:
            required_fields.append(field_name)
    
    configs[config_type][env_name] = config_dict
    
    # 保存到文件
    try:
        with open(CONFIG_FILE, 'a', encoding='utf-8') as f:
            f.write(f"\n[{config_type}:{env_name}]\n")
            for key, value in config_dict.items():
                f.write(f"{key}={value}\n")
        print(f"成功添加{config_type.capitalize()}配置 {env_name}")
    except Exception as e:
        print(f"保存配置失败: {e}")
    
    return configs

def add_new_config(configs):
    """添加新配置"""
    print("\n选择要添加的配置类型:")
    print("1. Qwen配置")
    print("2. Claude配置")
    
    try:
        choice = input("\n请选择 (输入数字): ").strip()
        
        if choice == "1":
            # 添加Qwen配置
            env_name = input("请输入环境名称: ").strip()
            if not env_name:
                print("环境名称不能为空")
                return configs
            
            qwen_fields = {
                'OPENAI_BASE_URL': {'prompt': '请输入OPENAI_BASE_URL: ', 'required': True},
                'OPENAI_API_KEY': {'prompt': '请输入OPENAI_API_KEY: ', 'required': True},
                'OPENAI_MODEL': {'prompt': '请输入OPENAI_MODEL (可选，留空则不设置): ', 'required': False}
            }
            
            return add_config_generic(configs, 'qwen', env_name, qwen_fields)
                
        elif choice == "2":
            # 添加Claude配置
            env_name = input("请输入环境名称: ").strip()
            if not env_name:
                print("环境名称不能为空")
                return configs
            
            claude_fields = {
                'ANTHROPIC_BASE_URL': {'prompt': '请输入ANTHROPIC_BASE_URL: ', 'required': True},
                'ANTHROPIC_AUTH_TOKEN': {'prompt': '请输入ANTHROPIC_AUTH_TOKEN: ', 'required': True},
                'ANTHROPIC_MODEL': {'prompt': '请输入ANTHROPIC_MODEL (可选，留空则不设置): ', 'required': False}
            }
            
            return add_config_generic(configs, 'claude', env_name, claude_fields)
        else:
            print("无效的选择")
            
    except KeyboardInterrupt:
        print("\n操作已取消")
    except Exception as e:
        print(f"添加配置时发生错误: {e}")
    
    return configs

def main():
    configs = parse_config_file()
    
    if not configs or (not configs['qwen'] and not configs['claude']):
        print("未找到任何环境配置")
        return
    
    while True:
        show_main_menu()
        try:
            choice = input("\n请选择 (输入数字): ").strip()
            
            if choice == "0":
                print("退出程序")
                break
                
            elif choice == "1":
                # 处理Qwen环境
                qwen_configs = configs['qwen']
                if not qwen_configs:
                    print("未找到任何Qwen环境配置")
                    continue
                
                while True:
                    env_names = show_qwen_menu(qwen_configs)
                    try:
                        env_choice = input("\n请选择Qwen环境配置 (输入数字): ").strip()
                        
                        if env_choice == "0":
                            break
                            
                        env_choice_num = int(env_choice)
                        if 1 <= env_choice_num <= len(env_names):
                            selected_env = env_names[env_choice_num - 1]
                            switch_qwen_env(selected_env, qwen_configs)
                        else:
                            print("无效的选择")
                    except ValueError:
                        print("请输入有效的数字")
                        
            elif choice == "2":
                # 处理Claude环境
                claude_configs = configs['claude']
                if not claude_configs:
                    print("未找到任何Claude环境配置")
                    continue
                
                while True:
                    env_names = show_claude_menu(claude_configs)
                    try:
                        env_choice = input("\n请选择Claude环境配置 (输入数字): ").strip()
                        
                        if env_choice == "0":
                            break
                            
                        env_choice_num = int(env_choice)
                        if 1 <= env_choice_num <= len(env_names):
                            selected_env = env_names[env_choice_num - 1]
                            switch_claude_env(selected_env, claude_configs)
                        else:
                            print("无效的选择")
                    except ValueError:
                        print("请输入有效的数字")
                        
            elif choice == "3":
                # 添加新配置
                configs = add_new_config(configs)
                
            else:
                print("无效的选择")
                
        except KeyboardInterrupt:
            print("\n操作已取消")
            break
        except Exception as e:
            print(f"发生错误: {e}")


if __name__ == "__main__":
    main()