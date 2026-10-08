-- The original Lovable prototype created these isolated tables outside the
-- AnjoLav ERP schema. They are empty and have no inbound foreign keys.
-- Keeping them public would leave unauthenticated Data API/GraphQL exposure.
DROP TABLE IF EXISTS public.notifications;
DROP TABLE IF EXISTS public.tasks;
DROP TABLE IF EXISTS public.settings;
DROP TABLE IF EXISTS public.drivers;
DROP TABLE IF EXISTS public.employees;
DROP TABLE IF EXISTS public.clients;
DROP TABLE IF EXISTS public.users;
