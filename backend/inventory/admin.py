from django.contrib import admin

from . import models

for model in (
    models.Vendor,
    models.Item,
    models.InventoryLot,
    models.PurchaseOrderLine,
    models.Customer,
    models.SalesLine,
    models.HandledFlag,
    models.DataNote,
):
    admin.site.register(model)
