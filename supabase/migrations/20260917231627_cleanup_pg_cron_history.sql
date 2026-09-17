-- pg_cron does not prune execution history automatically. This project runs a
-- job every minute, so retaining the full history caused cron.job_run_details
-- to grow beyond the application's largest tables and slowed restart queries.

delete from cron.job_run_details
where end_time < now() - interval '30 days';

do $migration$
begin
  if not exists (
    select 1
    from cron.job
    where jobname = 'cleanup-cron-job-run-details'
  ) then
    perform cron.schedule(
      'cleanup-cron-job-run-details',
      '17 3 * * *',
      $cleanup$
        delete from cron.job_run_details
        where end_time < now() - interval '30 days';
      $cleanup$
    );
  end if;
end
$migration$;
