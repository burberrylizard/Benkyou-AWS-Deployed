import { useState } from "react";
import DashboardLayout from "../../components/shared/DashboardLayout";
import { ADMIN_THEME, getNav, ADMIN_STYLES as s } from "./adminConfig";
import { useApiData } from "../../hooks/useApiData";
import { getCategories, createCategory, updateCategory, deleteCategory } from "../../services/categoryService";
import { useAuth } from "../../context/AuthContext";
import Modal from "../../components/shared/UI/Modal";
import Button from "../../components/shared/UI/Button";
import Pagination from "../../components/shared/Pagination";

export default function Categories() {
  const { user: authUser } = useAuth();
  const { data: categories, isLoading, reload } = useApiData(getCategories);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const displayCategories = categories || [];
  const paginatedCategories = displayCategories.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleOpenModal = (cat = null) => {
    setError("");
    setEditingCategory(cat);
    setCategoryName(cat ? cat.name : "");
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!categoryName.trim()) return;
    setIsSubmitting(true);
    setError("");
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.categoryID, { name: categoryName });
      } else {
        await createCategory({ name: categoryName });
      }
      setIsModalOpen(false);
      setCategoryName("");
      setEditingCategory(null);
      reload();
    } catch (err) {
      setError(err.message || "Failed to save category");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (cat) => {
    if (!window.confirm(`Are you sure you want to delete category "${cat.name}"?`)) return;
    try {
      await deleteCategory(cat.categoryID);
      reload();
    } catch (err) {
      alert(err.message || "Failed to delete category");
    }
  };

  const COLORS = ["#3b82f6", "#f59e0b", "#8b5cf6", "#10b981", "#ec4899", "#06b6d4"];

  return (
    <DashboardLayout 
      theme={ADMIN_THEME} 
      role="Admin" 
      navGroups={getNav("Categories")} 
      userName={authUser?.name} 
      headerTitle="Categories" 
      headerSub="Organize courses by category"
    >
      <div style={s.statsGrid}>
        <div style={s.card}>
          <div style={s.statLabel}>Total categories</div>
          <div style={s.statValue}>{displayCategories.length}</div>
          <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 500 }}>Defined</div>
        </div>
        <div style={s.card}>
          <div style={s.statLabel}>Active</div>
          <div style={s.statValue}>{displayCategories.filter(c => c.courseCount > 0).length}</div>
          <div style={{ fontSize: 12, color: "#10b981", fontWeight: 500 }}>With courses</div>
        </div>
      </div>

      <div style={s.tableCard}>
        <div style={s.cardHeader}>
          <h2 style={s.cardTitle}>All categories</h2>
          <Button onClick={() => handleOpenModal(null)}>+ Add category</Button>
        </div>
        
        {isLoading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Loading categories...</div>
        ) : (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16, marginBottom: 20 }}>
              {displayCategories.length === 0 ? (
                <div style={{ gridColumn: "1 / -1", padding: 40, textAlign: "center", color: "#9ca3af" }}>No categories found</div>
              ) : (
                paginatedCategories.map((cat, i) => {
                  const color = COLORS[i % COLORS.length];
                  return (
                    <div key={cat.categoryID} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 24, position: "relative", overflow: "hidden", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                      <div style={{ height: 4, background: color, position: "absolute", top: 0, left: 0, right: 0 }} />
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                        <div style={{ width: 44, height: 44, borderRadius: 10, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: color }}>
                          {cat.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button 
                            onClick={() => handleOpenModal(cat)}
                            style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 6, padding: "4px 8px", fontSize: 12, color: "#334155", fontWeight: 500, cursor: "pointer" }}
                          >
                            Edit
                          </button>
                          <button 
                            onClick={() => handleDelete(cat)}
                            style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 6, padding: "4px 8px", fontSize: 12, color: "#dc2626", fontWeight: 500, cursor: "pointer" }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 600, color: "#111827", marginBottom: 8 }}>{cat.name}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 13, color: "#4b5563" }}>{cat.courseCount} course{cat.courseCount !== 1 ? "s" : ""}</span>
                        {cat.courseCount === 0 && <span style={{ background: "#fef3c7", color: "#b45309", border: "1px solid #fde68a", padding: "3px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600 }}>Empty</span>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <Pagination
              totalItems={displayCategories.length}
              itemsPerPage={itemsPerPage}
              currentPage={currentPage}
              onChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingCategory ? "Edit category" : "Add category"}
        footer={
          <>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} isLoading={isSubmitting}>{editingCategory ? "Update category" : "Create category"}</Button>
          </>
        }
      >
        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#475569", letterSpacing: "0.05em" }}>CATEGORY NAME</label>
            <input 
              style={{ padding: "10px 14px", border: "1px solid #cbd5e1", borderRadius: 8, outline: "none", fontSize: 14, background: "#ffffff", color: "#0f172a" }}
              placeholder="e.g. Computer Science"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              autoFocus
              required
            />
          </div>
          {error && <div style={{ color: "#dc2626", fontSize: 13, fontWeight: 500 }}>{error}</div>}
        </form>
      </Modal>
    </DashboardLayout>
  );
}
