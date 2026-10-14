using Microsoft.EntityFrameworkCore;
using LivenessApi.Models;

namespace LivenessApi.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
    {
    }

    public DbSet<Rol> Roles => Set<Rol>();
    public DbSet<Usuario> Usuarios => Set<Usuario>();
    public DbSet<SolicitudVerificacion> SolicitudesVerificacion => Set<SolicitudVerificacion>();
    public DbSet<DocumentoIdentidad> DocumentosIdentidad => Set<DocumentoIdentidad>();
    public DbSet<RetoLiveness> RetosLiveness => Set<RetoLiveness>();
    public DbSet<IntentoVerificacion> IntentosVerificacion => Set<IntentoVerificacion>();
    public DbSet<LogAuditoria> LogsAuditoria => Set<LogAuditoria>();
    public DbSet<ConfiguracionSistema> ConfiguracionSistema => Set<ConfiguracionSistema>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Indices
        modelBuilder.Entity<SolicitudVerificacion>()
            .HasIndex(s => s.CodigoSolicitud)
            .IsUnique();

        modelBuilder.Entity<SolicitudVerificacion>()
            .HasIndex(s => s.Estado);

        modelBuilder.Entity<Usuario>()
            .HasIndex(u => u.Email)
            .IsUnique();

        modelBuilder.Entity<LogAuditoria>()
            .HasIndex(l => l.FechaRegistro);

        modelBuilder.Entity<LogAuditoria>()
            .HasIndex(l => l.Evento);

        // Relaciones
        modelBuilder.Entity<SolicitudVerificacion>()
            .HasOne(s => s.Documento)
            .WithOne(d => d.Solicitud)
            .HasForeignKey<DocumentoIdentidad>(d => d.SolicitudId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<SolicitudVerificacion>()
            .HasMany(s => s.Intentos)
            .WithOne(i => i.Solicitud)
            .HasForeignKey(i => i.SolicitudId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<SolicitudVerificacion>()
            .HasOne(s => s.UsuarioSolicitante)
            .WithMany(u => u.Solicitudes)
            .HasForeignKey(s => s.UsuarioSolicitanteId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<SolicitudVerificacion>()
            .HasOne(s => s.RevisadoPorUsuario)
            .WithMany()
            .HasForeignKey(s => s.RevisadoPorUsuarioId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<Usuario>()
            .HasOne(u => u.Rol)
            .WithMany(r => r.Usuarios)
            .HasForeignKey(u => u.RolId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
