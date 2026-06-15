package main

import "testing"

func TestNormalizeImageURL(t *testing.T) {
	valid, err := normalizeImageURL(" https://example.com/product.jpg ")
	if err != nil {
		t.Fatalf("expected valid URL, got %v", err)
	}
	if valid != "https://example.com/product.jpg" {
		t.Fatalf("unexpected normalized URL: %s", valid)
	}

	if _, err := normalizeImageURL("uploads/products/product.jpg"); err == nil {
		t.Fatal("expected local file path to be rejected")
	}
}
