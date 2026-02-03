-- ======================================
-- QUERY EXAMPLES: Violation Logs
-- ======================================

-- 1️⃣ Xem tất cả vi phạm của một test cụ thể
SELECT 
  id,
  violation_reason,
  violated_at,
  access_code_id,
  created_at
FROM test_violation_logs
WHERE test_id = 'YOUR_TEST_ID'
ORDER BY violated_at DESC;

-- 2️⃣ Xem vi phạm của một thí sinh dựa trên access_code_id
SELECT 
  id,
  violation_reason,
  violated_at,
  TO_CHAR(violated_at, 'DD/MM/YYYY HH24:MI:SS') as formatted_time
FROM test_violation_logs
WHERE access_code_id = 'YOUR_ACCESS_CODE_ID'
ORDER BY violated_at ASC;

-- 3️⃣ Thống kê số lượng vi phạm theo loại
SELECT 
  violation_reason,
  COUNT(*) as total_count,
  COUNT(DISTINCT access_code_id) as unique_students
FROM test_violation_logs
WHERE test_id = 'YOUR_TEST_ID'
GROUP BY violation_reason
ORDER BY total_count DESC;

-- 4️⃣ Danh sách thí sinh có vi phạm (kèm tên)
SELECT 
  ts.candidate_name,
  ts.access_code_id,
  COUNT(vl.id) as violation_count,
  STRING_AGG(DISTINCT vl.violation_reason, ', ') as violation_types
FROM test_submissions ts
JOIN test_violation_logs vl ON vl.access_code_id = ts.access_code_id
WHERE ts.test_id = 'YOUR_TEST_ID'
GROUP BY ts.candidate_name, ts.access_code_id
ORDER BY violation_count DESC;

-- 5️⃣ Chi tiết vi phạm của một submission cụ thể
SELECT 
  vl.violation_reason,
  vl.violated_at,
  TO_CHAR(vl.violated_at, 'HH24:MI:SS') as time_only,
  ts.candidate_name
FROM test_violation_logs vl
JOIN test_submissions ts ON ts.access_code_id = vl.access_code_id
WHERE ts.id = 'YOUR_SUBMISSION_ID'
ORDER BY vl.violated_at ASC;

-- 6️⃣ Tìm thí sinh có nhiều vi phạm nhất
SELECT 
  ts.candidate_name,
  ts.score_percent,
  ts.passed,
  COUNT(vl.id) as violation_count
FROM test_submissions ts
LEFT JOIN test_violation_logs vl ON vl.access_code_id = ts.access_code_id
WHERE ts.test_id = 'YOUR_TEST_ID'
GROUP BY ts.id, ts.candidate_name, ts.score_percent, ts.passed
HAVING COUNT(vl.id) > 0
ORDER BY violation_count DESC;

-- 7️⃣ Phân tích vi phạm theo thời gian (timeline)
SELECT 
  DATE_TRUNC('hour', violated_at) as hour,
  COUNT(*) as violation_count
FROM test_violation_logs
WHERE test_id = 'YOUR_TEST_ID'
GROUP BY hour
ORDER BY hour;

-- 8️⃣ Tìm các vi phạm xảy ra liền kề nhau (< 5 giây)
SELECT 
  vl1.violation_reason as first_violation,
  vl1.violated_at as first_time,
  vl2.violation_reason as second_violation,
  vl2.violated_at as second_time,
  EXTRACT(EPOCH FROM (vl2.violated_at - vl1.violated_at)) as seconds_between
FROM test_violation_logs vl1
JOIN test_violation_logs vl2 
  ON vl1.access_code_id = vl2.access_code_id 
  AND vl2.violated_at > vl1.violated_at
WHERE vl1.test_id = 'YOUR_TEST_ID'
  AND EXTRACT(EPOCH FROM (vl2.violated_at - vl1.violated_at)) < 5
ORDER BY vl1.violated_at;

-- 9️⃣ Export CSV-ready format
SELECT 
  ts.candidate_name as "Tên thí sinh",
  ts.score_percent as "Điểm (%)",
  ts.passed as "Đạt/Không đạt",
  ts.violation_count as "Tổng vi phạm",
  vl.violation_reason as "Loại vi phạm",
  TO_CHAR(vl.violated_at, 'DD/MM/YYYY HH24:MI:SS') as "Thời gian vi phạm"
FROM test_submissions ts
LEFT JOIN test_violation_logs vl ON vl.access_code_id = ts.access_code_id
WHERE ts.test_id = 'YOUR_TEST_ID'
ORDER BY ts.candidate_name, vl.violated_at;

-- 🔟 Tìm submission KHÔNG có log vi phạm (submission_id = null)
SELECT 
  id,
  violation_reason,
  violated_at,
  access_code_id
FROM test_violation_logs
WHERE submission_id IS NULL
  AND test_id = 'YOUR_TEST_ID'
ORDER BY violated_at DESC;

-- 1️⃣1️⃣ Xóa logs cũ (nếu cần cleanup)
-- ⚠️ CẢNH BÁO: Chỉ chạy khi chắc chắn cần xóa
/*
DELETE FROM test_violation_logs
WHERE violated_at < NOW() - INTERVAL '90 days'
  AND submission_id IS NOT NULL;
*/

-- 1️⃣2️⃣ Update submission_id cho logs đã nộp bài
-- (Nếu muốn link logs với submission sau khi nộp)
/*
UPDATE test_violation_logs vl
SET submission_id = ts.id
FROM test_submissions ts
WHERE vl.access_code_id = ts.access_code_id
  AND vl.test_id = ts.test_id
  AND vl.submission_id IS NULL;
*/
