#!/usr/bin/env node
/**
 * 游戏UI原型图分析 → Word策划文档导出
 * 
 * 用法: node export_docx.js --title "活动名称" --data analysis.json --image prototype.png --output output.docx
 * 
 * analysis.json 格式见底部说明
 */

const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
        Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
        LevelFormat, ShadingType, VerticalAlign, PageNumber, PageBreak } = require('docx');

// ============ 读取参数 ============
const args = process.argv.slice(2);
function getArg(name) {
    const idx = args.indexOf('--' + name);
    return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : null;
}

const title = getArg('title') || '游戏活动需求分析文档';
const dataFile = getArg('data');
const imagePath = getArg('image');
const annotatedImagePath = getArg('annotated-image');
const outputPath = getArg('output') || 'output.docx';

if (!dataFile) {
    console.error('用法: node export_docx.js --title "活动名称" --data analysis.json [--image prototype.png] [--annotated-image annotated.png] [--output output.docx]');
    process.exit(1);
}

const data = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));

// ============ 样式常量 ============
const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };
const headerFill = { fill: "1F4E79", type: ShadingType.CLEAR };
const altRowFill = { fill: "F2F7FB", type: ShadingType.CLEAR };

// ============ 辅助函数 ============
function makeCell(text, opts = {}) {
    const { bold, width, shading, align, fontSize, color } = opts;
    return new TableCell({
        borders,
        width: width ? { size: width, type: WidthType.DXA } : undefined,
        shading: shading || undefined,
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({
            alignment: align || AlignmentType.LEFT,
            spacing: { before: 40, after: 40 },
            children: [new TextRun({ text: String(text), bold: !!bold, size: fontSize || 20, font: "Microsoft YaHei", color: color || "000000" })]
        })]
    });
}

function makeHeaderRow(texts, widths) {
    return new TableRow({
        tableHeader: true,
        children: texts.map((t, i) => makeCell(t, { bold: true, width: widths[i], shading: headerFill, align: AlignmentType.CENTER, color: "FFFFFF" }))
    });
}

function heading(text, level) {
    return new Paragraph({ heading: level, spacing: { before: 300, after: 150 }, children: [new TextRun({ text, font: "Microsoft YaHei" })] });
}

function bullet(text, ref) {
    return new Paragraph({
        numbering: { reference: ref, level: 0 },
        spacing: { before: 60, after: 60 },
        children: [new TextRun({ text, size: 21, font: "Microsoft YaHei" })]
    });
}

function boldLabel(label, content, ref) {
    return new Paragraph({
        numbering: { reference: ref, level: 0 },
        spacing: { before: 60, after: 60 },
        children: [
            new TextRun({ text: label, bold: true, size: 21, font: "Microsoft YaHei" }),
            new TextRun({ text: content, size: 21, font: "Microsoft YaHei" })
        ]
    });
}

// ============ 构建文档 ============
async function buildDoc() {
    const children = [];

    // 封面标题
    children.push(new Paragraph({ spacing: { before: 2000 }, children: [] }));
    children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [new TextRun({ text: title, bold: true, size: 52, font: "Microsoft YaHei", color: "1F4E79" })]
    }));
    children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
        children: [new TextRun({ text: `游戏类型：${data.gameType || '捕鱼游戏'}`, size: 24, font: "Microsoft YaHei", color: "666666" })]
    }));
    children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 600 },
        children: [new TextRun({ text: `生成日期：${new Date().toLocaleDateString('zh-CN')}`, size: 24, font: "Microsoft YaHei", color: "666666" })]
    }));

    // 插入原型图
    if (imagePath && fs.existsSync(imagePath)) {
        children.push(new Paragraph({ children: [new PageBreak()] }));
        children.push(heading('原型图', HeadingLevel.HEADING_1));
        const imgBuf = fs.readFileSync(imagePath);
        const ext = path.extname(imagePath).slice(1).toLowerCase();
        children.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new ImageRun({ type: ext === 'jpg' ? 'jpeg' : ext, data: imgBuf, transformation: { width: 580, height: 380 }, altText: { title: "原型图", description: "游戏UI原型图", name: "prototype" } })]
        }));
    }

    // 插入标注图
    if (annotatedImagePath && fs.existsSync(annotatedImagePath)) {
        children.push(heading('标注分析图', HeadingLevel.HEADING_2));
        const annBuf = fs.readFileSync(annotatedImagePath);
        const ext2 = path.extname(annotatedImagePath).slice(1).toLowerCase();
        children.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new ImageRun({ type: ext2 === 'jpg' ? 'jpeg' : ext2, data: annBuf, transformation: { width: 580, height: 380 }, altText: { title: "标注图", description: "UI组件标注分析图", name: "annotated" } })]
        }));
    }

    // ===== 组件标注表 =====
    if (data.components && data.components.length > 0) {
        children.push(new Paragraph({ children: [new PageBreak()] }));
        children.push(heading('界面切分与组件标注', HeadingLevel.HEADING_1));

        const colWidths = [800, 1600, 1200, 1600, 1200, 2960];
        const headerRow = makeHeaderRow(['编号', '组件名称', '组件类型', '位置描述', '尺寸估算', '功能说明'], colWidths);
        const dataRows = data.components.map((c, i) => new TableRow({
            children: [
                makeCell(`${i + 1}`, { width: colWidths[0], align: AlignmentType.CENTER, shading: i % 2 ? altRowFill : undefined }),
                makeCell(c.name || '', { width: colWidths[1], shading: i % 2 ? altRowFill : undefined }),
                makeCell(c.type || '', { width: colWidths[2], align: AlignmentType.CENTER, shading: i % 2 ? altRowFill : undefined }),
                makeCell(c.position || '', { width: colWidths[3], shading: i % 2 ? altRowFill : undefined }),
                makeCell(c.size || '', { width: colWidths[4], align: AlignmentType.CENTER, shading: i % 2 ? altRowFill : undefined }),
                makeCell(c.description || '', { width: colWidths[5], shading: i % 2 ? altRowFill : undefined })
            ]
        }));

        children.push(new Table({ columnWidths: colWidths, rows: [headerRow, ...dataRows] }));
    }

    // ===== 界面结构树 =====
    if (data.structureTree) {
        children.push(new Paragraph({ spacing: { before: 300 }, children: [] }));
        children.push(heading('界面结构树', HeadingLevel.HEADING_2));
        data.structureTree.forEach(line => {
            children.push(new Paragraph({
                spacing: { before: 20, after: 20 },
                indent: { left: 360 },
                children: [new TextRun({ text: line, size: 20, font: "Consolas" })]
            }));
        });
    }

    // ===== 前端需求 =====
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(heading('前端功能需求 (Client Side)', HeadingLevel.HEADING_1));
    if (data.clientSide) {
        for (const [label, items] of Object.entries(data.clientSide)) {
            children.push(new Paragraph({
                spacing: { before: 150, after: 80 },
                children: [new TextRun({ text: label, bold: true, size: 22, font: "Microsoft YaHei", color: "1F4E79" })]
            }));
            (Array.isArray(items) ? items : [items]).forEach(item => children.push(bullet(item, 'bullets')));
        }
    }

    // ===== 服务器需求 =====
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(heading('服务器需求 (Server Side)', HeadingLevel.HEADING_1));
    if (data.serverSide) {
        for (const [label, items] of Object.entries(data.serverSide)) {
            children.push(new Paragraph({
                spacing: { before: 150, after: 80 },
                children: [new TextRun({ text: label, bold: true, size: 22, font: "Microsoft YaHei", color: "1F4E79" })]
            }));
            (Array.isArray(items) ? items : [items]).forEach(item => children.push(bullet(item, 'bullets')));
        }
    }

    // ===== 美术需求 =====
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(heading('美术需求 (Art Side)', HeadingLevel.HEADING_1));
    if (data.artSide) {
        for (const [label, items] of Object.entries(data.artSide)) {
            children.push(new Paragraph({
                spacing: { before: 150, after: 80 },
                children: [new TextRun({ text: label, bold: true, size: 22, font: "Microsoft YaHei", color: "1F4E79" })]
            }));
            (Array.isArray(items) ? items : [items]).forEach(item => children.push(bullet(item, 'bullets')));
        }
    }

    // ===== 构建文档对象 =====
    const doc = new Document({
        styles: {
            default: { document: { run: { font: "Microsoft YaHei", size: 21 } } },
            paragraphStyles: [
                { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
                  run: { size: 32, bold: true, color: "1F4E79", font: "Microsoft YaHei" },
                  paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 0 } },
                { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
                  run: { size: 26, bold: true, color: "2E75B6", font: "Microsoft YaHei" },
                  paragraph: { spacing: { before: 180, after: 100 }, outlineLevel: 1 } }
            ]
        },
        numbering: {
            config: [{
                reference: "bullets",
                levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } } }]
            }]
        },
        sections: [{
            properties: {
                page: { margin: { top: 1200, right: 1200, bottom: 1200, left: 1200 } }
            },
            headers: {
                default: new Header({ children: [new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [new TextRun({ text: title + " — 策划需求文档", size: 16, color: "999999", font: "Microsoft YaHei" })]
                })] })
            },
            footers: {
                default: new Footer({ children: [new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: "第 ", size: 16, color: "999999" }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "999999" }), new TextRun({ text: " 页", size: 16, color: "999999" })]
                })] })
            },
            children
        }]
    });

    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(outputPath, buffer);
    console.log(`[OK] Word文档已生成: ${outputPath}`);
}

buildDoc().catch(err => { console.error('[错误]', err.message); process.exit(1); });
