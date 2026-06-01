-- V31__pan_de_casa_sin_control_stock.sql
-- El pan de casa se vende por kilo y no requiere control de stock automático.

UPDATE public.products
SET track_stock = FALSE
WHERE barcode = 'PCZ-PAN-KG';
