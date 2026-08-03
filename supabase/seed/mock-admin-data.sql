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
--
-- `offered_return` is the PUBLIC return the project advertises to raise capital
-- (free text, never parsed). It is not capital_contributions.agreed_return —
-- see the migration 20260802120000_catalog_public_fields.sql. Wording stays
-- deliberately non-committal ("Hasta…", ranges) so nothing reads as guaranteed.
-- Two projects leave it NULL on purpose, to exercise the catalogue's neutral
-- state when a project has no public return yet.
--
-- The set below is sized to exercise every catalogue filter: all seven statuses,
-- the four cities, the four types, and all four progress ranges (0–25, 25–50,
-- 50–75, 75–100).
insert into public.projects
  (name, company, address, city, type, status, lot_value, capital_required,
   estimated_sale_value, estimated_rent, progress, responsible, next_step,
   deadline, in_fundraising, fundraising_goal, offered_return, description)
values
  ('Villa Rotonda 118', 'Investors 180 Group', '118 Rotonda Blvd E', 'Rotonda',
   'casa', 'construcción', 42000, 310000, 465000, 2800, 62, 'Camilo Restrepo',
   'Inspección de plomería', '2026-11-20', false, null, 'Hasta 15% anual',
   '[MOCK] Casa unifamiliar de 3 habitaciones en Rotonda West.'),
  ('Punta Gorda Duplex 24', 'F1', '24 Gulfstream Ave', 'Punta Gorda',
   'triplex', 'permisos', 78000, 520000, 720000, 5200, 15, 'Laura Méndez',
   'Radicar permisos de construcción', '2027-02-10', true, 180000, '12–15% anual',
   '[MOCK] Triplex en zona de alta demanda de renta.'),
  ('North Port Lote 7', 'F3', '7 Sumter Blvd', 'North Port',
   'lote', 'en evaluación', 29000, 29000, 61000, null, 0, 'Camilo Restrepo',
   'Due diligence de suelo', '2026-09-30', true, 29000, 'Participación desde 10%',
   '[MOCK] Lote residencial listo para construir.'),
  ('Rotonda Multifamily 402', 'Investors 180 Group', '402 Boundary Blvd', 'Rotonda',
   'multifamily', 'en reserva', 145000, 980000, 1350000, 11500, 5, 'Laura Méndez',
   'Cierre de oferta', '2027-06-15', true, 420000, 'Hasta 12% anual',
   '[MOCK] Edificio de 6 unidades para renta a largo plazo.'),
  ('Casa Gulf Cove 55', 'F1', '55 Gulf Cove Dr', 'Otra',
   'casa', 'vendido', 38000, 275000, 402000, null, 100, 'Camilo Restrepo',
   'Cerrado', '2026-04-08', false, null, null,
   '[MOCK] Proyecto cerrado con venta ejecutada en abril.'),
  ('Rotonda Casa 210', 'Investors 180 Group', '210 Rotonda Cir', 'Rotonda',
   'casa', 'rentado', 51000, 340000, 480000, 3100, 100, 'Laura Méndez',
   'Renovación de contrato de renta', '2027-01-31', false, null,
   'Participación desde 8%',
   '[MOCK] Casa entregada y arrendada, genera renta mensual.'),
  ('North Port Triplex 12', 'F3', '12 Cranberry Blvd', 'North Port',
   'triplex', 'pausado', 66000, 430000, 610000, 4200, 38, 'Camilo Restrepo',
   'A la espera de revisión de permisos', '2027-04-30', false, null, null,
   '[MOCK] Obra pausada mientras se resuelve un trámite municipal.'),
  ('Punta Gorda Lote 9', 'F1', '9 Marion Ave', 'Punta Gorda',
   'lote', 'permisos', 34000, 96000, 158000, null, 45, 'Laura Méndez',
   'Aprobación de survey', '2026-12-15', true, 96000, 'Hasta 14% anual',
   '[MOCK] Lote en el centro de Punta Gorda, cerca del waterfront.'),
  ('Gulf Cove Multifamily 8', 'Otra LLC', '8 Gulf Cove Way', 'Otra',
   'multifamily', 'construcción', 132000, 760000, 1050000, 8900, 72,
   'Camilo Restrepo', 'Instalación de cubiertas', '2027-03-20', true, 260000,
   '10–13% anual',
   '[MOCK] Edificio de 4 unidades en fase avanzada de construcción.'),
  ('North Port Casa 31', 'F3', '31 Biscayne Dr', 'North Port',
   'casa', 'vendido', 40000, 290000, 415000, null, 100, 'Laura Méndez',
   'Cerrado', '2026-02-27', false, null, null,
   '[MOCK] Proyecto cerrado con venta ejecutada en febrero.');

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

-- -----------------------------------------------------------------------------
-- MOCK transactions for the investor home screen (added later, via the REST
-- API, because they need the real investor/project UUIDs).
--
-- They belong to the investor linked to the developer account and reproduce the
-- figures from the design spec: 3 open positions ($45.926 + $15.000 + $10.000 =
-- $70.926 current capital) plus one fully closed position ($70.000 contributed,
-- $70.000 returned, $18.500 yield) which yields +26,43% accumulated return.
--
-- They carry no [MOCK] marker of their own — `transactions` has no free-text
-- column — so they are removed by investor instead:
--
--   delete from public.transactions
--     where investor_id in (select id from public.investors);
--
-- Adjust the filter if real transactions ever coexist with these.
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- MOCK capital_contributions for the developer's investor, added so the
-- "Mis inversiones" cards show a real agreed return. They deliberately cover
-- every branch of the resolution rule (lib/projects/labels.ts):
--   Villa Rotonda 118      one contribution   -> "15% anual"
--   Punta Gorda Duplex 24  two, both equal    -> "12% anual"
--   Rotonda Multifamily    two that disagree  -> "Varios"
--   North Port Lote 7      participation      -> "Participación 10%"
-- The fourth position also makes the grid show an incomplete row (3 + 1).
--
-- Removed together with the rest: they carry '[MOCK]' in `comments`.
--   delete from public.capital_contributions where comments like '[MOCK]%';
-- -----------------------------------------------------------------------------
