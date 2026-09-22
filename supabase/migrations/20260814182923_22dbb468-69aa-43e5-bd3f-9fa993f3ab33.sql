delete from tenant_members where tenant_id = 'd3729e33-62ce-4f8c-8ca6-b3fdd31ccb12';
delete from tenants where id = 'd3729e33-62ce-4f8c-8ca6-b3fdd31ccb12';
insert into tenant_members (tenant_id, user_id, role)
values ('a0000000-0000-0000-0000-000000000001', '2284e730-7271-485e-8345-db8357be2907', 'owner')
on conflict do nothing;