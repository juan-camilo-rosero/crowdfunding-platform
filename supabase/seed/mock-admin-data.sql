-- =============================================================================
-- MOCK DATA for the admin panel. NOT part of the schema and NOT for production.
--
-- Every row is tagged with the marker '[MOCK]' in a free-text column
-- (projects.description, investors.notes), which is what the cleanup at the
-- bottom keys off. Do not remove those markers.
--
-- Applied with the service role key from scripts/seed-mock.ts.
-- =============================================================================

-- ---------------------------------------------------------------- projects --
insert into public.projects
  (name, company, address, city, type, status, lot_value, capital_required,
   estimated_sale_value, estimated_rent, progress, responsible, next_step,
   deadline, in_fundraising, fundraising_goal, description)
values
  ('Villa Rotonda 118', 'Investors 180 Group', '118 Rotonda Blvd E', 'Rotonda',
   'casa', 'construcción', 42000, 310000, 465000, 2800, 62, 'Camilo Restrepo',
   'Inspección de plomería', '2026-11-20', false, null,
   '[MOCK] Casa unifamiliar de 3 habitaciones en Rotonda West.'),
  ('Punta Gorda Duplex 24', 'F1', '24 Gulfstream Ave', 'Punta Gorda',
   'triplex', 'permisos', 78000, 520000, 720000, 5200, 15, 'Laura Méndez',
   'Radicar permisos de construcción', '2027-02-10', true, 180000,
   '[MOCK] Triplex en zona de alta demanda de renta.'),
  ('North Port Lote 7', 'F3', '7 Sumter Blvd', 'North Port',
   'lote', 'en evaluación', 29000, 29000, 61000, null, 0, 'Camilo Restrepo',
   'Due diligence de suelo', '2026-09-30', true, 29000,
   '[MOCK] Lote residencial listo para construir.'),
  ('Rotonda Multifamily 402', 'Investors 180 Group', '402 Boundary Blvd', 'Rotonda',
   'multifamily', 'en reserva', 145000, 980000, 1350000, 11500, 5, 'Laura Méndez',
   'Cierre de oferta', '2027-06-15', true, 420000,
   '[MOCK] Edificio de 6 unidades para renta a largo plazo.'),
  ('Casa Gulf Cove 55', 'F1', '55 Gulf Cove Dr', 'Otra',
   'casa', 'vendido', 38000, 275000, 402000, null, 100, 'Camilo Restrepo',
   'Cerrado', '2026-04-08', false, null,
   '[MOCK] Proyecto cerrado con venta ejecutada en abril.');

-- --------------------------------------------------------------- investors --
insert into public.investors
  (full_name, document_id, phone, email, city_country, potential_amount,
   pipeline_stage, investment_type_pref, first_contact_date, last_contact_date,
   status, notes)
values
  ('María Fernanda Gómez', '1020345678', '+573014567890', 'mf.gomez@ejemplo.com',
   'Medellín, Colombia', 120000, 'desembolsado', 'equity',
   '2025-09-12', '2026-06-02', 'recibido', '[MOCK] Inversionista recurrente.'),
  ('Andrés Felipe Ruiz', '79856412', '+573122233445', 'af.ruiz@ejemplo.com',
   'Bogotá, Colombia', 85000, 'firmado', 'deuda',
   '2025-11-03', '2026-05-18', 'comprometido', '[MOCK] Firmó en mayo.'),
  ('Catalina Ospina', '43128976', '+573205558899', 'c.ospina@ejemplo.com',
   'Cali, Colombia', 60000, 'en reunión', 'préstamo',
   '2026-01-22', '2026-07-11', 'interesado', '[MOCK] Pidió estados de cuenta.'),
  ('Jorge Iván Betancur', '71234567', '+573001112233', 'ji.betancur@ejemplo.com',
   'Rionegro, Colombia', 200000, 'calificado', 'socio',
   '2026-03-05', '2026-07-25', 'en revisión', '[MOCK] Evaluando multifamily.'),
  ('Sandra Milena Cardona', '52987654', '+573156667788', 'sm.cardona@ejemplo.com',
   'Barranquilla, Colombia', 45000, 'contacto', 'participación',
   '2026-07-01', '2026-07-28', 'prospecto', '[MOCK] Contacto por referido.');

-- =============================================================================
-- CLEANUP — removes every mock row created above:
--
--   delete from public.investors where notes like '[MOCK]%';
--   delete from public.projects where description like '[MOCK]%';
-- =============================================================================

-- -----------------------------------------------------------------------------
-- The remaining tables were seeded through the REST API in the same session
-- (they need the real project/investor UUIDs as foreign keys):
--   capital_contributions · budget_items · tasks · monthly_reports
--   documents · reassignment_requests · investment_interests
--
-- Those rows carry '[MOCK]' in their free-text column where the schema has one
-- (comments / decisions), and they all hang off the mock projects above, so the
-- cleanup below removes them by cascade of the parent delete.
-- -----------------------------------------------------------------------------

-- FULL CLEANUP (run in this order):
--   delete from public.investment_interests where comments like '[MOCK]%';
--   delete from public.reassignment_requests
--     where from_project_id in (select id from public.projects where description like '[MOCK]%');
--   delete from public.documents
--     where project_id in (select id from public.projects where description like '[MOCK]%');
--   delete from public.monthly_reports
--     where project_id in (select id from public.projects where description like '[MOCK]%');
--   delete from public.tasks
--     where project_id in (select id from public.projects where description like '[MOCK]%');
--   delete from public.budget_items
--     where project_id in (select id from public.projects where description like '[MOCK]%');
--   delete from public.capital_contributions
--     where project_id in (select id from public.projects where description like '[MOCK]%');
--   delete from public.investors where notes like '[MOCK]%';
--   delete from public.projects where description like '[MOCK]%';
