import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    const apiKey = process.env.GEMINI_API_KEY || "";
    const genAI = new GoogleGenerativeAI(apiKey);
    // Chuyển sang gemini-pro để đảm bảo tính ổn định cao nhất và tránh lỗi 404
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    try {
        const { action, question, correctAnswer, currentContent } = await req.json();

        if (action === "generate-distractors") {
            const prompt = `Bạn là một chuyên gia soạn đề thi. Tôi có một câu hỏi và đáp án đúng như sau:
Câu hỏi: "${question}"
Đáp án đúng: "${correctAnswer}"

Hãy tạo ra đúng 3 đáp án nhiễu (distractors) trông có vẻ hợp lý nhưng thực tế là sai. 
Yêu cầu:
- Đáp án nhiễu phải liên quan chặt chẽ đến câu hỏi.
- Định dạng trả về: chỉ trả về mảng JSON chứa 3 chuỗi đáp án, không kèm giải thích.
Ví dụ: ["đáp án 1", "đáp án 2", "đáp án 3"]`;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            // Extract JSON if AI adds markdown
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            const distractors = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

            return NextResponse.json({ success: true, distractors });
        }

        if (action === "refine-question") {
            const prompt = `Bạn là một biên tập viên chuyên nghiệp. Hãy sửa lỗi chính tả, ngữ pháp và tối ưu văn phong cho câu hỏi sau đây để nó chuyên nghiệp và dễ hiểu hơn. Chỉ trả về nội dung câu hỏi đã được sửa, không thêm lời dẫn.

Nội dung cũ: "${currentContent}"`;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const refinedText = response.text().trim();

            return NextResponse.json({ success: true, refinedText });
        }

        return NextResponse.json({ success: false, error: "Action not supported" }, { status: 400 });
    } catch (error: any) {
        console.error("Gemini API Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
