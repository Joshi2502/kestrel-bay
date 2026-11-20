from django.db import models


class Vendor(models.Model):
    code = models.CharField(max_length=10, primary_key=True)
    name = models.CharField(max_length=120)
    country = models.CharField(max_length=60, blank=True)
    lead_time_days_system = models.IntegerField(null=True, blank=True)
    lead_time_days = models.IntegerField(null=True, blank=True)
    safety_days = models.IntegerField(default=7)
    is_supplier = models.BooleanField(default=True)

    def __str__(self) -> str:
        return f"{self.code} {self.name}"


class Item(models.Model):
    code = models.CharField(max_length=40, primary_key=True)
    description = models.CharField(max_length=200)
    category = models.CharField(max_length=60, blank=True)
    storage = models.CharField(max_length=20, blank=True)
    pack_size_raw = models.CharField(max_length=60, blank=True)
    lbs_per_case = models.FloatField(null=True, blank=True)
    planning_uom = models.CharField(max_length=2, default="CS")
    vendor = models.ForeignKey(Vendor, null=True, on_delete=models.SET_NULL, related_name="items")
    shelf_life_months = models.IntegerField(null=True, blank=True)
    status_raw = models.CharField(max_length=20, blank=True)
    status = models.CharField(max_length=20, default="active")
    in_scope = models.BooleanField(default=True)
    # "" | "fresh" | "dead_code" | "discontinued"
    scope_reason = models.CharField(max_length=20, blank=True)

    def __str__(self) -> str:
        return self.code


class InventoryLot(models.Model):
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name="lots")
    location = models.CharField(max_length=20)
    lot_no = models.CharField(max_length=40)
    qty = models.FloatField()
    uom = models.CharField(max_length=2)
    qty_planning = models.FloatField(null=True, blank=True)
    pack_date = models.DateField(null=True, blank=True)
    expiry_date = models.DateField(null=True, blank=True)
    received_date = models.DateField(null=True, blank=True)
    unit_cost = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    snapshot_date = models.DateField()
    is_adjustment = models.BooleanField(default=False)


class PurchaseOrderLine(models.Model):
    po_no = models.CharField(max_length=20)
    line_no = models.IntegerField()
    vendor = models.ForeignKey(Vendor, on_delete=models.CASCADE, related_name="po_lines")
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name="po_lines")
    order_date = models.DateField(null=True, blank=True)
    expected_date = models.DateField(null=True, blank=True)
    qty_ordered = models.FloatField()
    qty_received = models.FloatField(default=0)
    uom = models.CharField(max_length=2)
    status = models.CharField(max_length=20)
    unit_cost = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    class Meta:
        unique_together = ("po_no", "line_no")


class Customer(models.Model):
    code = models.CharField(max_length=20, primary_key=True)
    name = models.CharField(max_length=120)
    customer_type = models.CharField(max_length=20, blank=True)


class SalesLine(models.Model):
    order_no = models.CharField(max_length=20)
    line_no = models.IntegerField()
    order_date = models.DateField()
    ship_date = models.DateField()
    customer_code = models.CharField(max_length=20)
    customer_name = models.CharField(max_length=120)
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name="sales_lines")
    qty = models.FloatField()
    uom = models.CharField(max_length=2)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20)
    is_clean_demand = models.BooleanField(default=False)
    # "" | cancelled | credit | sample | transfer | one_off | out_of_scope
    exclusion_reason = models.CharField(max_length=20, blank=True)

    class Meta:
        indexes = [models.Index(fields=["item", "ship_date"])]


class HandledFlag(models.Model):
    """Dana's 'I've handled this' note: an order BlueTide doesn't know about yet."""

    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name="handled_flags")
    note = models.CharField(max_length=300, blank=True)
    qty = models.FloatField(null=True, blank=True)
    expected_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_on = models.DateField()
    active = models.BooleanField(default=True)


class DataNote(models.Model):
    kind = models.CharField(max_length=40)
    message = models.CharField(max_length=300)
    count = models.IntegerField(default=0)
