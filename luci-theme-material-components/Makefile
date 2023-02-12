include $(TOPDIR)/rules.mk

LUCI_TITLE:=Material Components Theme
LUCI_DEPENDS:=

# TODO package build dependency NodeJS

define Package/luci-theme-material-components/postrm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	uci -q delete luci.themes.MaterialComponents
	uci commit luci
}
endef

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
