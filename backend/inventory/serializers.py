from rest_framework import serializers

from .models import Vendor


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField()


class HandledSerializer(serializers.Serializer):
    note = serializers.CharField(max_length=300, required=False, allow_blank=True, default="")
    qty = serializers.FloatField(min_value=0, required=False, allow_null=True, default=None)
    expected_date = serializers.DateField(required=False, allow_null=True, default=None)


class VendorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vendor
        fields = [
            "code",
            "name",
            "country",
            "lead_time_days_system",
            "lead_time_days",
            "safety_days",
        ]
        read_only_fields = ["code", "name", "country", "lead_time_days_system"]
        extra_kwargs = {
            "lead_time_days": {"min_value": 0, "max_value": 365},
            "safety_days": {"min_value": 0, "max_value": 365},
        }
