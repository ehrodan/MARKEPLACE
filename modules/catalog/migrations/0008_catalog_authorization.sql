insert into iam.permissions (permission_code, description) values
  ('catalog.items.manage', 'Criar e administrar itens do catálogo global'),
  ('catalog.assets.manage', 'Criar e administrar assets do catálogo global'),
  ('catalog.assets.review', 'Aprovar ou rejeitar assets do catálogo global')
on conflict (permission_code) do nothing;
