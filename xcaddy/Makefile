# SPDX-License-Identifier: GPL-3.0-only
#
# Copyright (C) 2021 ImmortalWrt.org

include $(TOPDIR)/rules.mk

PKG_NAME:=xcaddy
PKG_RELEASE:=2.7.5

PKG_LICENSE_FILES:=LICENSE
PKG_MAINTAINER:=Coolkid

include $(INCLUDE_DIR)/package.mk

XCADDY_FILE:=caddy
define Download/xcaddy
  URL:=https://caddyserver.com/api/download?os=linux&arch=amd64&p=github.com%2Faksdb%2Fcaddy-cgi%2Fv2&p=github.com%2Fzhangjiayin%2Fcaddy-geoip2
  FILE:=$(XCADDY_FILE)
  HASH:=skip
endef

define Package/xcaddy/template
  SECTION:=net
  CATEGORY:=Network
  SUBMENU:=Web Servers/Proxies
  DEPENDS:=@(x86_64)
endef

define Package/xcaddy
  $(call Package/xcaddy/template)
  TITLE:=Caddy2 is an open source web server
  VERSION:=$(PKG_RELEASE)
  LICENSE:=CC-BY-SA-4.0
endef

define Build/Prepare
	$(call Build/Prepare/Default)
ifneq ($(CONFIG_PACKAGE_xcaddy),)
	$(call Download,xcaddy)
endif
endef

define Build/Compile
endef

define Package/xcaddy/install
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) $(GO_PKG_BUILD_BIN_DIR)/caddy $(1)/usr/bin/caddy
	chmod +x $(1)/usr/bin/caddy
	$(INSTALL_DIR) $(1)/etc/caddy
	$(INSTALL_CONF) ./files/Caddyfile $(1)/etc/caddy/Caddyfile
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/caddy.init $(1)/etc/init.d/caddy
endef

$(eval $(call BuildPackage,xcaddy))