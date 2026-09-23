"""Static helper data for the admin 'Category & Car Model' dropdown."""
from fastapi import APIRouter

router = APIRouter(prefix="/api/catalog", tags=["catalog"])

# Cars common on Pakistani roads (plus a few popular imports). Admin can also type any other make/model.
CAR_MODELS: dict[str, list[str]] = {
    "Toyota": ["Corolla", "Yaris", "Camry", "Land Cruiser", "Prado", "Fortuner", "Hilux Revo", "Vitz", "Aqua", "Prius", "Passo", "Raize", "Rush"],
    "Honda": ["Civic", "City", "Accord", "BR-V", "HR-V", "Vezel", "N-One", "N-WGN"],
    "Suzuki": ["Alto", "Cultus", "Swift", "Wagon R", "Jimny", "Every", "Bolan", "Ravi"],
    "Kia": ["Sportage", "Picanto", "Stonic", "Sorento", "Carnival"],
    "Hyundai": ["Tucson", "Elantra", "Sonata", "Santa Fe", "Porter"],
    "Changan": ["Alsvin", "Oshan X7", "Karvaan", "Uni-T"],
    "MG": ["HS", "ZS", "5"],
    "Nissan": ["Dayz", "Sunny", "Note", "Juke", "X-Trail"],
    "Daihatsu": ["Mira", "Cast", "Move", "Tanto", "Hijet"],
    "Mitsubishi": ["Pajero", "Lancer", "Outlander"],
    "BMW": ["3 Series", "5 Series", "X1", "X5", "M2"],
    "Mercedes-Benz": ["C-Class", "E-Class", "G-Class", "GLE"],
    "Audi": ["A3", "A4", "A6", "Q5", "Q7"],
    "Tesla": ["Model 3", "Model Y"],
    "Porsche": ["911", "Cayenne", "Macan"],
    "Ford": ["Mustang", "Ranger", "Everest"],
}


@router.get("/car-models")
def car_models():
    return {
        "universal": "Universal (fits all cars)",
        "makes": [{"make": m, "models": models} for m, models in CAR_MODELS.items()],
    }
