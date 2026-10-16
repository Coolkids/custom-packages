include $(TOPDIR)/rules.mk

PKG_NAME:=singbox-ruleset
PKG_VERSION:=2026.10.16~27ad2e7d
PKG_RELEASE:=1

PKG_SOURCE_PROTO:=git
PKG_SOURCE_URL:=https://github.com/Coolkids/custom-ruleset.git
PKG_SOURCE_VERSION:=27ad2e7d88c448dbd4779f6c97d030940dbb4e48
PKG_SOURCE_SUBDIR:=$(PKG_NAME)-$(PKG_VERSION)
PKG_SOURCE:=$(PKG_SOURCE_SUBDIR).tar.gz
PKG_MIRROR_HASH:=cd46619e9671e8d6e0ee7ff2d66a100fdb0d908eb7ed141ddb6e49889d5a45a3

PKG_MAINTAINER:=Coolkids
PKG_LICENSE:=MIT

include $(INCLUDE_DIR)/package.mk

define Package/singbox-ruleset
  SECTION:=net
  CATEGORY:=Network
  TITLE:=Custom Sing-box RuleSet (geoip & geosite)
  DEPENDS:=
endef

define Package/singbox-ruleset/description
Prebuilt sing-box rule-sets generated from v2ray-rules-dat via geoview.
Installs geoip and geosite srs files into /usr/share/singbox.
endef

define Build/Compile
	
endef

define Package/singbox-ruleset/install
	$(INSTALL_DIR) $(1)/usr/share/singbox

	$(CP) $(PKG_BUILD_DIR)/output/geoip/*.srs $(1)/usr/share/singbox/
	$(CP) $(PKG_BUILD_DIR)/output/geosite/*.srs $(1)/usr/share/singbox/
endef

$(eval $(call BuildPackage,singbox-ruleset))
