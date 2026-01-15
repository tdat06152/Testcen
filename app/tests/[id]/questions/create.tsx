// app/tests/[id]/questions/create.tsx
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

export default function CreateQuestion({ params }: { params: { id: string } }) {
  async function create(formData: FormData) {
    'use server';
    const supabase = createClient();
    const question = formData.get('question') as string;
    const type = formData.get('type') as string;
    const score = Number(formData.get('score'));
    const options = [
      formData.get('option1'),
      formData.get('option2'),
      formData.get('option3'),
      formData.get('option4')
    ].filter(Boolean);
    const correct = formData.get('correct');

    let image_url = null;
    const file = formData.get('image') as File;
    if (file && file.size > 0) {
      const { data, error } = await supabase.storage
        .from('question-images')
        .upload(`${params.id}/${Date.now()}-${file.name}`, file);
      if (data) image_url = supabase.storage.from('question-images').getPublicUrl(data.path).data.publicUrl;
    }

    await supabase.from('questions').insert({
      test_id: params.id,
      question,
      type,
      options: type === 'multiple-choice' ? options : null,
      correct_answer: type === 'multiple-choice' ? correct : null,
      image_url,
      score
    });

    redirect(`/tests/${params.id}/questions`);
  }

  return (
    <form action={create} className="space-y-4 p-6 bg-white dark:bg-gray-800 rounded-lg">
      <h1 className="text-2xl font-bold text-orange-500">Tạo câu hỏi mới</h1>
      
      <select name="type" className="w-full p-2 border rounded">
        <option value="multiple-choice">Trắc nghiệm</option>
        <option value="essay">Tự luận</option>
      </select>

      <input name="question" required placeholder="Nội dung câu hỏi" className="w-full p-2 border rounded" />

      <input type="number" name="score" defaultValue="1" min="1" className="w-full p-2 border rounded" />

      <div className="space-y-2">
        <input name="option1" placeholder="Đáp án A" className="w-full p-2 border rounded" />
        <input name="option2" placeholder="Đáp án B" className="w-full p-2 border rounded" />
        <input name="option3" placeholder="Đáp án C" className="w-full p-2 border rounded" />
        <input name="option4" placeholder="Đáp án D" className="w-full p-2 border rounded" />
        <select name="correct" className="w-full p-2 border rounded">
          <option value="">Chọn đáp án đúng</option>
          <option value="0">A</option>
          <option value="1">B</option>
          <option value="2">C</option>
          <option value="3">D</option>
        </select>
      </div>

      <input type="file" name="image" accept="image/*" className="w-full" />

      <button type="submit" className="px-6 py-2 bg-green-500 text-white rounded hover:bg-green-600">
        Tạo câu hỏi
      </button>
    </form>
  );
}