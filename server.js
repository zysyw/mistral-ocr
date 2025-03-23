import express from "express";
import multer from "multer";
import dotenv from "dotenv";
import fs from "fs";
import { Mistral } from "@mistralai/mistralai";
import path from "path";

dotenv.config();

const app = express();
const port = 3000;
const upload = multer({ dest: "uploads/" });

const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });

// 静态前端页面
app.use(express.static("public"));

// 上传并 OCR 处理
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const filePath = req.file.path;
    const fileContent = fs.readFileSync(filePath);
    const fileName = req.file.originalname;
    const mimeType = req.file.mimetype;

    // 上传文件到 Mistral Cloud
    const uploaded = await client.files.upload({
      file: {
        fileName: fileName,
        content: fileContent,
      },
      purpose: "ocr"
    });
    
    // 获取 signed URL
    const signed = await client.files.getSignedUrl({ fileId: uploaded.id });

    // 判断类型，构造 OCR 参数
    let document;
    if (mimeType === "application/pdf") {
      document = {
        type: "document_url",
        documentUrl: signed.url
      };
    } else if (mimeType.startsWith("image/")) {
      document = {
        type: "image_url",
        imageUrl: signed.url
      };
    } else {
      throw new Error("Unsupported file type: " + mimeType);
    }

    // 调用 OCR
    const ocrResponse = await client.ocr.process({
      model: "mistral-ocr-latest",
      document,
      includeImageBase64: true
    });

    // 清理临时文件
    fs.unlinkSync(filePath);

    // 返回给前端
    res.json({
      pages: ocrResponse.pages // 返回完整页面数组
    });
  } catch (err) {
    console.error("OCR Error:", err);
    res.status(500).json({ error: err.message || "Unknown error" });
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
