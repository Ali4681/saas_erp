-- Hand-written CHECKs for Phase 3 integration foundation (survive migrate-dev).
ALTER TABLE `project_credentials`
  ADD CONSTRAINT `chk_project_credentials_key_version` CHECK (`key_version` > 0);

ALTER TABLE `project_sync_states`
  ADD CONSTRAINT `chk_project_sync_failures_non_negative` CHECK (`consecutive_failures` >= 0);

ALTER TABLE `integration_jobs`
  ADD CONSTRAINT `chk_integration_jobs_attempt_count` CHECK (`attempt_count` >= 0);

ALTER TABLE `integration_errors`
  ADD CONSTRAINT `chk_integration_errors_occurrence` CHECK (`occurrence_count` > 0);
