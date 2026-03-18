#!/bin/bash
# ================================================
# game-system-designer 技能安装脚本
# 适用于 QoderWork / 任何支持 SKILL.md 的 LLM 环境
# ================================================

set -e

echo "=========================================="
echo " 游戏系统策划技能 - 安装脚本"
echo "=========================================="

# 1. 确定安装目录
if [ -d "$HOME/.qoderwork/skills" ]; then
    INSTALL_DIR="$HOME/.qoderwork/skills/game-system-designer"
    echo "[INFO] 检测到 QoderWork 环境"
elif [ -d "$HOME/.qoder/skills" ]; then
    INSTALL_DIR="$HOME/.qoder/skills/game-system-designer"
    echo "[INFO] 检测到 Qoder CLI 环境"
else
    INSTALL_DIR="$HOME/.qoderwork/skills/game-system-designer"
    echo "[INFO] 使用默认路径: $INSTALL_DIR"
fi

echo "[INFO] 安装目录: $INSTALL_DIR"

# 2. 复制技能文件
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$INSTALL_DIR/scripts"

cp "$SCRIPT_DIR/SKILL.md" "$INSTALL_DIR/"
cp "$SCRIPT_DIR/data-format.md" "$INSTALL_DIR/"
cp "$SCRIPT_DIR/scripts/analyze_ui.py" "$INSTALL_DIR/scripts/"
cp "$SCRIPT_DIR/scripts/generate_wireframe.py" "$INSTALL_DIR/scripts/"
cp "$SCRIPT_DIR/scripts/export_docx.js" "$INSTALL_DIR/scripts/"
cp "$SCRIPT_DIR/scripts/export_xlsx.py" "$INSTALL_DIR/scripts/"
cp "$SCRIPT_DIR/requirements.txt" "$INSTALL_DIR/"

echo "[OK] 技能文件已复制"

# 3. 安装 Python 依赖
echo "[INFO] 安装 Python 依赖..."
pip install -q requests Pillow openpyxl 2>/dev/null || pip3 install -q requests Pillow openpyxl 2>/dev/null || {
    echo "[WARN] Python 依赖安装失败，请手动执行: pip install requests Pillow openpyxl"
}

# 4. 安装 Node 依赖 (用于 Word 导出)
echo "[INFO] 安装 Node 依赖..."
if command -v npm &>/dev/null; then
    cp "$SCRIPT_DIR/scripts/package.json" "$INSTALL_DIR/scripts/"
    cd "$INSTALL_DIR/scripts" && npm install --quiet 2>/dev/null || {
        echo "[WARN] npm 依赖安装失败，请手动执行: cd $INSTALL_DIR/scripts && npm install"
    }
else
    echo "[WARN] 未检测到 npm，Word 导出功能需手动安装: npm install docx"
fi

# 5. 配置 API Key
if [ -z "$DASHSCOPE_API_KEY" ]; then
    echo ""
    echo "[配置] 视觉分析功能需要阿里 DashScope API Key"
    echo "  方式1: export DASHSCOPE_API_KEY=sk-your-key-here"
    echo "  方式2: 在 analyze_ui.py 中直接修改 DASHSCOPE_API_KEY 变量"
    echo ""
fi

# 6. 中文字体检查
echo "[INFO] 检查中文字体..."
FONT_OK=false
for fp in /tmp/msyh.ttc /usr/share/fonts/truetype/wqy/wqy-microhei.ttc /usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc; do
    if [ -f "$fp" ]; then
        echo "[OK] 找到中文字体: $fp"
        FONT_OK=true
        break
    fi
done

if [ "$FONT_OK" = false ]; then
    echo "[WARN] 未找到中文字体，原型图生成可能显示方块"
    echo "  修复方法:"
    echo "  - Windows: cp C:/Windows/Fonts/msyh.ttc /tmp/msyh.ttc"
    echo "  - Linux:   sudo apt install fonts-wqy-microhei"
    echo "  - macOS:   cp /System/Library/Fonts/PingFang.ttc /tmp/pingfang.ttc"
fi

echo ""
echo "=========================================="
echo " 安装完成！"
echo " 技能路径: $INSTALL_DIR"
echo "=========================================="
echo ""
echo "使用方法:"
echo "  1. 在 QoderWork 中直接上传游戏原型图即可触发"
echo "  2. 或描述需求: \"帮我设计一个XXX活动\""
echo "  3. 技能会自动完成: 分析→出图→导出文档"
echo ""
