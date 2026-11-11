include $(TOPDIR)/rules.mk

PKG_NAME:=oxidns
PKG_VERSION:=1.7.0
PKG_RELEASE:=1

PKG_LICENSE:=MIT
PKG_MAINTAINER:=Coolkid

PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)
PKG_SOURCE_URL:=https://github.com/svenshi/oxidns/releases/download/v$(PKG_VERSION)

PKG_HASH_X86_64_GLIBC:=bafa819102407c9c399cd9260227b1b930b0235e57c6a08c4642a43b0eb534c9
PKG_HASH_X86_64_MUSL:=9e4dd773c6d082e02d55e1dc3b852c2ed6574af612574e94834b625d3a9cc770
PKG_HASH_AARCH64_GLIBC:=5470c74c63ff51e77eff7fad3813269e7cdc2213d0b251957febad3b449146e8
PKG_HASH_AARCH64_MUSL:=8256b57d537d3044693051f1e1521d00dbbf6311f3d422b3582aac6b0ffbe6a9

include $(INCLUDE_DIR)/package.mk
include $(TOPDIR)/feeds/packages/lang/rust/rust-values.mk

PKG_SOURCE:=oxidns-$(RUST_TARGET).tar.gz

ifeq ($(ARCH),x86_64)
    ifeq ($(CONFIG_USE_GLIBC),y)
        PKG_SOURCE:=oxidns-x86_64-unknown-linux-gnu.tar.gz
		PKG_HASH:=$(PKG_HASH_X86_64_GLIBC)
    else
        PKG_SOURCE:=oxidns-x86_64-unknown-linux-musl.tar.gz
		PKG_HASH:=$(PKG_HASH_X86_64_MUSL)
    endif
else ifeq ($(ARCH),aarch64)
    ifeq ($(CONFIG_USE_GLIBC),y)
        PKG_SOURCE:=oxidns-aarch64-unknown-linux-gnu.tar.gz
		PKG_HASH:=$(PKG_HASH_AARCH64_GLIBC)
    else
        PKG_SOURCE:=oxidns-aarch64-unknown-linux-musl.tar.gz
		PKG_HASH:=$(PKG_HASH_AARCH64_MUSL)
    endif
else
	PKG_HASH:=dummy
endif

define Package/oxidns
  SECTION:=net
  CATEGORY:=Network
  TITLE:=OxiDNS DNS Proxy
  URL:=https://github.com/svenshi/oxidns
  DEPENDS:=+ca-bundle
endef

define Package/oxidns/description
  High performance DNS proxy written in Rust.
endef

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
	$(TAR) -xzf $(DL_DIR)/$(PKG_SOURCE) -C $(PKG_BUILD_DIR)
endef

define Build/Compile
endef

define Package/oxidns/conffiles
/etc/oxidns/config.yaml
endef

define Package/oxidns/install
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) \
		$(PKG_BUILD_DIR)/oxidns \
		$(1)/usr/bin/oxidns

	$(INSTALL_DIR) $(1)/etc/oxidns

	$(INSTALL_CONF) \
		$(PKG_BUILD_DIR)/config.yaml \
		$(1)/etc/oxidns/config.yaml

	cp -a \
		$(PKG_BUILD_DIR)/webui \
		$(1)/etc/oxidns/
endef

$(eval $(call BuildPackage,oxidns))

