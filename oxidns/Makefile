include $(TOPDIR)/rules.mk

PKG_NAME:=oxidns
PKG_VERSION:=1.3.0
PKG_RELEASE:=1

PKG_LICENSE:=MIT
PKG_MAINTAINER:=Coolkid

PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)
PKG_SOURCE_URL:=https://github.com/svenshi/oxidns/releases/download/v$(PKG_VERSION)

PKG_HASH_X86_64_GLIBC:=43c5cb58ce4b435319fb45188037b6e6b1addb18a3202258ed9c16b2938692f5
PKG_HASH_X86_64_MUSL:=57b25112ffbb1e1719218eb215ebb9d7773c9b92231e71973780a922c30f15ab
PKG_HASH_AARCH64_GLIBC:=7b786145d7f7a05f8ac5f3b474b8293a70f3e871d59473c571e0344265fc2a06
PKG_HASH_AARCH64_MUSL:=191224b8955d659d326fc85208a7974295f21b25df3b64f4d9de3a5a95e41548

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

	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/oxidns.init \
		$(1)/etc/init.d/oxidns
endef

$(eval $(call BuildPackage,oxidns))

