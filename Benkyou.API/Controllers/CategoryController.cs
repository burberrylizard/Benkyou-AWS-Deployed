namespace Benkyou.API.Controllers;

using Benkyou.Core.DTOs;
using Benkyou.Data;
using Benkyou.Data.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("api/categories")]
[Authorize]
public class CategoriesController(BenkyouDbContext db) : BaseController
{
    private readonly BenkyouDbContext _db = db;

    [HttpPost]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<IActionResult> Create(CreateCategoryDto dto)
    {
        var name = dto.Name.Trim();
        if (await _db.Categories.AnyAsync(c => c.TenantID == TenantId && c.Name.ToLower() == name.ToLower()))
        {
            return BadRequest(new { message = "Category with this name already exists." });
        }

        var category = new Category
        {
            Name = name,
            TenantID = TenantId
        };

        _db.Categories.Add(category);
        await _db.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            data = category
        });
    }

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var data = await _db.Categories
            .Where(c => IsSuperAdmin || c.TenantID == TenantId)
            .Include(c => c.Courses)
            .Select(c => new {
                c.CategoryID,
                c.Name,
                CourseCount = c.Courses.Count
            })
            .ToListAsync();

        return Ok(data);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<IActionResult> Update(int id, CreateCategoryDto dto)
    {
        var category = await _db.Categories
            .FirstOrDefaultAsync(c => c.CategoryID == id && (IsSuperAdmin || c.TenantID == TenantId));

        if (category == null)
            return NotFound(new { message = "Category not found." });

        var name = dto.Name.Trim();
        if (await _db.Categories.AnyAsync(c => c.CategoryID != id && c.TenantID == TenantId && c.Name.ToLower() == name.ToLower()))
        {
            return BadRequest(new { message = "Category with this name already exists." });
        }

        category.Name = name;
        await _db.SaveChangesAsync();

        return Ok(new { success = true, data = category });
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<IActionResult> Delete(int id)
    {
        var category = await _db.Categories
            .Include(c => c.Courses)
            .FirstOrDefaultAsync(c => c.CategoryID == id && (IsSuperAdmin || c.TenantID == TenantId));

        if (category == null)
            return NotFound(new { message = "Category not found." });

        if (category.Courses != null && category.Courses.Count > 0)
        {
            var fallbackCategory = await _db.Categories
                .FirstOrDefaultAsync(c => c.TenantID == category.TenantID && c.CategoryID != id);

            if (fallbackCategory == null)
            {
                fallbackCategory = new Category
                {
                    TenantID = category.TenantID,
                    Name = "General",
                    IsActive = true
                };
                _db.Categories.Add(fallbackCategory);
                await _db.SaveChangesAsync();
            }

            foreach (var course in category.Courses)
            {
                course.CategoryID = fallbackCategory.CategoryID;
            }
        }

        _db.Categories.Remove(category);
        await _db.SaveChangesAsync();

        return Ok(new { success = true, message = "Category deleted successfully." });
    }
}