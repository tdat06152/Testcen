// app/tests/[id]/questions/[qid]/edit.tsx
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { notFound } from 'next/navigation';

export default async function EditQuestion({ params }: { params: { id: string; qid: string } }) {
  const supabase = await createClient();

  const { data: question } = await supabase
    .from('questions')
    .select('*')
    .eq('id', params.qid)
    .eq('test_id', params.id)
    .single();

  if (!question) notFound();

  async function update(formData: FormData) {
    'use server';
    const supabase = await createClient();

    const content = formData.get('content') as string;
    const type = formData.get('type') as string;
    const score = Number(formData.get('score'));

    const options = [
      formData.get('option1'),
      formData.get('option2'),
      formData.get('option3'),
      formData.get('option4')
    ].filter(Boolean);

    const correct = formData.get('correct');

    let image_url = question.image_url;
    const file = formData.get('image') as File;
    if (file && file.size > 0) {
      const { data, error } = await supabase.storage
        .from('question-images')
        .upload(`${params.id}/${Date.now()}-${file.name}`, file, { upsert: true });
      if (data) image_url = supabase.storage.from('question-images').getPublicUrl(data.path).data.publicUrl;
    }

    await supabase
      .from('questions')
      .update({
        content,
        type,
        options: type === 'multiple-choice' ? options : null,
        correct_answer: type === 'multiple-choice' ? correct : null,
        image_url,
        score
      })
      .eq('id', params.qid);

    redirect(`/tests/${params.id}/questions`);
  }

  return (
    <form action={update} className="space-y-4 p-6 bg-white dark:bg-gray-800 rounded-lg">
      <h1 className="text-2xl font-bold text-orange-500">Sửa câu hỏi</h1>

      <select name="type" defaultValue={question.type} className="w-full p-2 border rounded">
        <option value="multiple-choice">Trắc nghiệm</option>
        <option value="essay">Tự luận</option>
      </select>

      <textarea name="content" defaultValue={question.content} required placeholder="Nội dung câu hỏi" className="w-full p-2 border rounded h-32" />

      <input type="number" name="score" defaultValue={question.score} min="1" className="w-full p-2 border rounded" />

      <div className="space-y-2">
        <input name="option1" defaultValue={question.options?.[0] || ''} placeholder="Đáp án A" className="w-full p-2 border rounded" />
        <input name="option2" defaultValue={question.options?.[1] || ''} placeholder="Đáp án B" className="w-full p-2 border rounded" />
        <input name="option3" defaultValue={question.options?.[2] || ''} placeholder="Đáp án C" className="w-full p-2 border rounded" />
        <input name="option4" defaultValue={question.options?.[3] || ''} placeholder="Đáp án D" className="w-full p-2 border rounded" />

        <select name="correct" defaultValue={question.correct_answer} className="w-full p-2 border rounded">
          <option value="">Chọn đáp án đúng</option>
          <option value="0">A</option>
          <option value="1">B</option>
          <option value="2">C</option>
          <option value="3">D</option>
        </select>
      </div>

      {question.image_url && <img src={question.image_url} alt="Current" className="max-w-md" />}
      <input type="file" name="image" accept="image/*" className="w-full" />

      <button type="submit" className="px-6 py-2 bg-green-500 text-white rounded hover:bg-green-600">
        Lưu thay đổi
      </button>
    </form>
  );
}