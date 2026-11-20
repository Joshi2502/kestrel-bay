from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.middleware.csrf import get_token
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import HandledFlag, Item, Vendor
from .rules.constants import NON_SUPPLIER_VENDORS
from .serializers import HandledSerializer, LoginSerializer, VendorSerializer
from .services import build_dashboard, build_item_detail, set_handled


@api_view(["GET"])
@permission_classes([AllowAny])
def csrf(request):
    get_token(request._request)
    return Response({"detail": "ok"})


@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    form = LoginSerializer(data=request.data)
    form.is_valid(raise_exception=True)
    user = authenticate(request._request, **form.validated_data)
    if user is None:
        return Response(
            {"detail": "Wrong username or password"}, status=status.HTTP_400_BAD_REQUEST
        )
    login(request._request, user)
    return Response({"username": user.get_username()})


@api_view(["POST"])
def logout_view(request):
    logout(request._request)
    return Response({"detail": "logged out"})


@api_view(["GET"])
@permission_classes([AllowAny])
def me(request):
    if request.user.is_authenticated:
        return Response({"authenticated": True, "username": request.user.get_username()})
    return Response({"authenticated": False})


@api_view(["GET"])
def dashboard(request):
    return Response(build_dashboard())


@api_view(["GET"])
def item_detail(request, code):
    try:
        return Response(build_item_detail(code.upper()))
    except Item.DoesNotExist:
        return Response({"detail": "Item not found"}, status=status.HTTP_404_NOT_FOUND)


@api_view(["POST", "DELETE"])
def handled(request, code):
    code = code.upper()
    if not Item.objects.filter(code=code).exclude(scope_reason="fresh").exists():
        return Response({"detail": "Item not found"}, status=status.HTTP_404_NOT_FOUND)
    if request.method == "DELETE":
        HandledFlag.objects.filter(item_id=code, active=True).update(active=False)
        return Response(status=status.HTTP_204_NO_CONTENT)
    form = HandledSerializer(data=request.data)
    form.is_valid(raise_exception=True)
    set_handled(code, **form.validated_data, as_of=settings.AS_OF_DATE)
    return Response({"detail": "marked handled"}, status=status.HTTP_201_CREATED)


@api_view(["GET"])
def vendors(request):
    suppliers = Vendor.objects.exclude(code__in=NON_SUPPLIER_VENDORS).order_by("code")
    return Response(VendorSerializer(suppliers, many=True).data)


@api_view(["PATCH"])
def vendor_detail(request, code):
    try:
        vendor = Vendor.objects.exclude(code__in=NON_SUPPLIER_VENDORS).get(code=code.upper())
    except Vendor.DoesNotExist:
        return Response({"detail": "Vendor not found"}, status=status.HTTP_404_NOT_FOUND)
    form = VendorSerializer(vendor, data=request.data, partial=True)
    form.is_valid(raise_exception=True)
    form.save()
    return Response(form.data)
