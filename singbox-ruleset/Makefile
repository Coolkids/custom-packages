include $(TOPDIR)/rules.mk

PKG_NAME:=singbox-ruleset
PKG_VERSION:=2026.09.29~e032d191
PKG_RELEASE:=1

PKG_SOURCE_PROTO:=git
PKG_SOURCE_URL:=https://github.com/Coolkids/custom-ruleset.git
PKG_SOURCE_VERSION:=e032d191280082c59997847ba8aa2f1fa23473be
PKG_SOURCE_SUBDIR:=$(PKG_NAME)-$(PKG_VERSION)
PKG_SOURCE:=$(PKG_SOURCE_SUBDIR).tar.gz
PKG_MIRROR_HASH:=7466be84e8b264f3cb03cb5ee1e58469f7ed66f9310633196d0e62e80f06673b

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
