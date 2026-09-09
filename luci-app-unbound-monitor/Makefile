include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-unbound-monitor
PKG_VERSION:=1.1.1
PKG_RELEASE:=1

LUCI_TITLE:=LuCI Unbound Performance Monitor
LUCI_PKGARCH:=all
LUCI_DEPENDS:=+luci-base +luci-lib-chartjs +rpcd +unbound-control

PKG_MAINTAINER:=Coolkids(s196774065@gmail.com)

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
