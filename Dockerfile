# Stage 1: Build & Publish
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy csproj files and restore dependencies
COPY ["Benkyou.API/Benkyou.API.csproj", "Benkyou.API/"]
COPY ["Benkyou.Core/Benkyou.Core.csproj", "Benkyou.Core/"]
COPY ["Benkyou.Data/Benkyou.Data.csproj", "Benkyou.Data/"]
RUN dotnet restore "Benkyou.API/Benkyou.API.csproj"

# Copy all files and publish Release build
COPY . .
WORKDIR "/src/Benkyou.API"
RUN dotnet publish "Benkyou.API.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Stage 2: Final ASP.NET Core 8 Runtime Image
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "Benkyou.API.dll"]
