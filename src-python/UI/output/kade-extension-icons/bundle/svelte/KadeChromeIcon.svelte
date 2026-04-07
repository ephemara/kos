<script lang="ts">
  import { getKadeChromeIconEntry, getKadeChromeIconPath, type KadeChromeIconFormat } from "./icons"

  export let name: string
  export let format: KadeChromeIconFormat = "svg"
  export let base = ".."
  export let alt = name
  export let className = ""
  export let size: number | string | null = null
  export let title: string | null = null

  $: src = getKadeChromeIconPath(name, format, base)
  $: resolved = getKadeChromeIconEntry(name)
  $: dimension = typeof size === "number" ? `${size}px` : size
  $: style = dimension ? `width: ${dimension}; height: ${dimension};` : undefined
</script>

{#if src}
  <img
    src={src}
    alt={alt}
    class={className}
    title={title ?? resolved?.title ?? alt}
    style={style}
    data-kade-icon={resolved?.name ?? name}
    data-kade-icon-category={resolved?.category ?? undefined}
    loading="lazy"
    decoding="async"
  />
{/if}
