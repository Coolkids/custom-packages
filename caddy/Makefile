# Copyright (C) 2010-2020 OpenWrt.org
#
# This is free software, licensed under the GNU General Public License v2.
# See /LICENSE for more information.
#

include $(TOPDIR)/rules.mk

PKG_NAME:=caddy
PKG_VERSION:=2.8.4
PKG_RELEASE:=1

PKG_SOURCE:=$(PKG_NAME)-$(PKG_VERSION).tar.gz
PKG_SOURCE_URL:=https://codeload.github.com/caddyserver/caddy/tar.gz/v$(PKG_VERSION)?
PKG_HASH:=5c2e95ad9e688a18dd9d9099c8c132331e01e0bebd401183e8d9123372cf4fcc

PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)

PKG_MAINTAINER:=SYB

PKG_BUILD_DEPENDS:=golang/host
PKG_BUILD_PARALLEL:=1
PKG_USE_MIPS16:=0

GO_PKG:=github.com/caddyserver/caddy/v2
GO_PKG_TAG:=-tags full
GO_PKG_LDFLAGS:=-s -w

include $(INCLUDE_DIR)/package.mk
include $(TOPDIR)/feeds/packages/lang/golang/golang-package.mk

define Package/$(PKG_NAME)
  TITLE:=Caddy2 is an open source web server
  URL:=https://caddyserver.com
  SECTION:=net
  CATEGORY:=Network
  SUBMENU:=Web Servers/Proxies
  DEPENDS:=$(GO_ARCH_DEPENDS) +libpthread
endef

define Package/$(PKG_NAME)/description
Still the only web server to use TLS automatically and by default. Deploy and scale HTTPS effortlessly with Caddy2.
endef


define Build/Prepare
	$(call Build/Prepare/Default)
endef

define Build/Compile
	$(eval GO_PKG_BUILD_PKG:=$(GO_PKG)/cmd/caddy)
	$(call GoPackage/Build/Configure)
	$(call GoPackage/Build/Compile)
endef

define Package/$(PKG_NAME)/install
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) $(GO_PKG_BUILD_BIN_DIR)/caddy $(1)/usr/bin/caddy
	$(INSTALL_DIR) $(1)/etc/caddy
	$(INSTALL_CONF) ./files/Caddyfile $(1)/etc/caddy/Caddyfile
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/caddy.init $(1)/etc/init.d/caddy
endef

$(eval $(call GoBinPackage,$(PKG_NAME)))
$(eval $(call BuildPackage,$(PKG_NAME)))
