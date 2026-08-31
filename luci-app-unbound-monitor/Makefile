include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-unbound-monitor
PKG_RELEASE:=1

PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)

include $(INCLUDE_DIR)/package.mk


define Package/luci-app-unbound-monitor
	SECTION:=luci
	CATEGORY:=LuCI
	SUBMENU:=3. Applications
	TITLE:=LuCI Unbound Performance Monitor
	DEPENDS:=+luci-base +rpcd +unbound-control
	PKGARCH:=all
endef


define Package/luci-app-unbound-monitor/description
	A real-time Unbound performance monitoring dashboard for LuCI.
endef


define Build/Compile
endef


define Package/luci-app-unbound-monitor/install

	$(INSTALL_DIR) \
		$(1)/www/luci-static/resources/view/unbound-monitor

	$(INSTALL_DATA) \
		./htdocs/luci-static/resources/unbound-monitor/dashboard.css \
		$(1)/www/luci-static/resources/unbound-monitor/dashboard.css

	$(INSTALL_DATA) \
		./htdocs/luci-static/resources/view/unbound-monitor/dashboard.js \
		$(1)/www/luci-static/resources/view/unbound-monitor/dashboard.js


	$(INSTALL_DIR) \
		$(1)/usr/libexec/rpcd

	$(INSTALL_BIN) \
		./root/usr/libexec/rpcd/unbound-monitor \
		$(1)/usr/libexec/rpcd/unbound-monitor


	$(INSTALL_DIR) \
		$(1)/usr/share/luci/menu.d

	$(INSTALL_DATA) \
		./root/usr/share/luci/menu.d/luci-app-unbound-monitor.json \
		$(1)/usr/share/luci/menu.d/luci-app-unbound-monitor.json


	$(INSTALL_DIR) \
		$(1)/usr/share/rpcd/acl.d

	$(INSTALL_DATA) \
		./root/usr/share/rpcd/acl.d/luci-app-unbound-monitor.json \
		$(1)/usr/share/rpcd/acl.d/luci-app-unbound-monitor.json


	$(INSTALL_DIR) \
		$(1)/etc/uci-defaults

	$(INSTALL_BIN) \
		./root/etc/uci-defaults/99-luci-app-unbound-monitor \
		$(1)/etc/uci-defaults/99-luci-app-unbound-monitor

endef


$(eval $(call BuildPackage,luci-app-unbound-monitor))