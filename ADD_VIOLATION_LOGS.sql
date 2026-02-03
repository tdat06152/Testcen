-- Tạo bảng lưu lịch sử chi tiết các lần vi phạm
-- Mỗi lần vi phạm sẽ được ghi lại với thời gian và lý do cụ thể

CREATE TABLE IF NOT EXISTS test_violation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES test_submissions(id) ON DELETE CASCADE,
  test_id UUID REFERENCES tests(id) ON DELETE CASCADE,
  access_code_id UUID REFERENCES test_access_codes(id) ON DELETE CASCADE,
  violation_reason TEXT NOT NULL, -- "Rời khỏi tab làm bài", "Mất tập trung vào màn hình làm bài (Blur)", v.v.
  violated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- Thời điểm vi phạm
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index để query nhanh hơn
CREATE INDEX IF NOT EXISTS idx_violation_logs_submission ON test_violation_logs(submission_id);
CREATE INDEX IF NOT EXISTS idx_violation_logs_test ON test_violation_logs(test_id);
CREATE INDEX IF NOT EXISTS idx_violation_logs_access_code ON test_violation_logs(access_code_id);

-- Enable RLS
ALTER TABLE test_violation_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Chỉ admin/owner mới xem được logs
-- (Ban đầu để public cho đơn giản, sau này có thể tùy chỉnh)
CREATE POLICY "Enable read access for all users" ON test_violation_logs
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" ON test_violation_logs
  FOR INSERT WITH CHECK (true);

COMMENT ON TABLE test_violation_logs IS 'Lưu lịch sử chi tiết từng lần vi phạm anti-cheat';
COMMENT ON COLUMN test_violation_logs.violation_reason IS 'Lý do vi phạm: tab switch, blur, fullscreen exit, etc.';
COMMENT ON COLUMN test_violation_logs.violated_at IS 'Thời điểm chính xác khi vi phạm xảy ra';
